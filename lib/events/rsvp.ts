import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { track, type AnalyticsRsvpStatus } from "@/lib/analytics/track";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { visibilityTokens } from "@/lib/db/visibility";
import { sendEventEmail } from "@/lib/email/transport";
import { getRevealedJoinUrl } from "@/lib/events/join-link";
import { getVisibleEvent } from "@/lib/events/list";

const choiceSchema = z.enum(["yes", "no", "maybe"]);

export type RsvpChoice = z.infer<typeof choiceSchema>;
export type StoredRsvpStatus = RsvpChoice | "waitlist";

export type RsvpWriteContext = {
  ip: string;
  userAgent: string;
};

export type RsvpResult = { ok: true; status: StoredRsvpStatus } | { ok: false };

function asStoredStatus(value: string): StoredRsvpStatus | null {
  switch (value) {
    case "yes":
    case "no":
    case "maybe":
    case "waitlist":
      return value;
    default:
      return null;
  }
}

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

function intersects(visibility: string[], tokens: string[]): boolean {
  return visibility.some((token) => tokens.includes(token));
}

/**
 * Option (b): lock on events.lock_key, a unique bigserial distinct from the uuid PK.
 * Collision-free by construction. Not a public identifier; FKs still reference id.
 */
export async function acquireEventRsvpLock(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<void> {
  await tx.$queryRaw<{ locked: string }[]>`
    SELECT pg_advisory_xact_lock(lock_key)::text AS locked
    FROM events
    WHERE id = ${eventId}::uuid
  `;
}

function trackRsvp(
  claims: SessionClaims,
  eventId: string,
  rsvpStatus: AnalyticsRsvpStatus,
  distinctId = claims.userId,
): void {
  track("event_rsvp", {
    distinctId,
    programRole: claims.programRole,
    adminRole: claims.adminRole,
    eventId,
    rsvpStatus,
  });
}

export async function getOwnEventRsvp(
  session: SessionClaims | null,
  eventId: string,
): Promise<StoredRsvpStatus | null> {
  const claims = requireRole(session);
  const row = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) =>
      tx.eventRsvp.findUnique({
        where: { userId_eventId: { userId: claims.userId, eventId } },
        select: { status: true },
      }),
  );
  return row ? asStoredStatus(row.status) : null;
}

export async function setEventRsvp(
  session: SessionClaims | null,
  eventId: string,
  choice: RsvpChoice,
  context: RsvpWriteContext,
): Promise<RsvpResult> {
  const claims = requireRole(session);
  const parsed = choiceSchema.safeParse(choice);
  if (!parsed.success) {
    return { ok: false };
  }
  const requested = parsed.data;
  const tokens = visibilityTokens(claims);
  if (tokens.length === 0) {
    return { ok: false };
  }
  const ip = context.ip;
  const userAgent = context.userAgent.slice(0, 512);

  const result = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      await acquireEventRsvpLock(tx, eventId);
      const eventRow = await tx.event.findFirst({
        where: { id: eventId, cancelledAt: null },
        select: { id: true, capacity: true, visibility: true },
      });
      if (!eventRow || !intersects(eventRow.visibility, tokens)) {
        return { ok: false } as const;
      }

      const existing = await tx.eventRsvp.findUnique({
        where: { userId_eventId: { userId: claims.userId, eventId } },
        select: { status: true, waitlistedAt: true },
      });
      const previous = existing ? asStoredStatus(existing.status) : null;
      const yesCountRows = await tx.$queryRaw<{ n: number }[]>`
        SELECT event_yes_count(${eventId}::uuid) AS n
      `;
      const yesCount = Number(yesCountRows[0]?.n ?? 0);
      const otherYesCount = previous === "yes" ? Math.max(yesCount - 1, 0) : yesCount;

      let nextStatus: StoredRsvpStatus = requested;
      let waitlistedAt: Date | null = null;
      if (requested === "yes") {
        const cap = eventRow.capacity;
        const alreadyYes = previous === "yes";
        if (!alreadyYes && cap !== null && otherYesCount >= cap) {
          nextStatus = "waitlist";
          waitlistedAt =
            previous === "waitlist" && existing?.waitlistedAt
              ? existing.waitlistedAt
              : new Date();
        }
      }

      await tx.eventRsvp.upsert({
        where: { userId_eventId: { userId: claims.userId, eventId } },
        create: {
          userId: claims.userId,
          eventId,
          status: nextStatus,
          waitlistedAt,
        },
        update: {
          status: nextStatus,
          waitlistedAt,
        },
      });

      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "event_rsvp",
        entityType: "event",
        entityId: eventId,
        ip,
        userAgent,
        metadata: previous
          ? { fromStatus: previous, toStatus: nextStatus }
          : { rsvpStatus: nextStatus },
        severity: "info",
      });

      let promotedUserId: string | null = null;
      if (previous === "yes" && nextStatus !== "yes") {
        const promoted = await tx.$queryRaw<{ event_promote_oldest_waitlist: string | null }[]>`
          SELECT event_promote_oldest_waitlist(${eventId}::uuid) AS event_promote_oldest_waitlist
        `;
        promotedUserId = promoted[0]?.event_promote_oldest_waitlist ?? null;
        if (promotedUserId) {
          await writeAudit(tx, {
            actorUserId: claims.userId,
            actorRole: actorRole(claims),
            action: "event_rsvp",
            entityType: "event",
            entityId: eventId,
            targetUserId: promotedUserId,
            ip,
            userAgent,
            metadata: { fromStatus: "waitlist", toStatus: "yes", rsvpStatus: "yes" },
            severity: "info",
          });
        }
      }

      return { ok: true, status: nextStatus, previous, promotedUserId } as const;
    },
  );

  if (!result.ok) {
    return { ok: false };
  }

  trackRsvp(claims, eventId, result.status);
  if (result.promotedUserId) {
    trackRsvp(claims, eventId, "yes", result.promotedUserId);
  }
  if (result.status === "yes" && result.previous !== "yes") {
    await sendYesInviteEmail(claims, eventId, claims.userId);
  }
  if (result.promotedUserId) {
    await sendYesInviteEmail(claims, eventId, result.promotedUserId);
  }
  return { ok: true, status: result.status };
}

async function sendYesInviteEmail(
  viewer: SessionClaims,
  eventId: string,
  recipientUserId: string,
): Promise<void> {
  const event = await getVisibleEvent(viewer, eventId, { trackView: false });
  if (!event) {
    return;
  }
  const staffLookup = recipientUserId !== viewer.userId;
  const user = await withRls(
    staffLookup
      ? { adminRole: "admin", status: "active" }
      : {
          userId: viewer.userId,
          programRole: viewer.programRole,
          adminRole: viewer.adminRole,
          status: viewer.status,
        },
    (tx) =>
      tx.user.findUnique({
        where: { id: recipientUserId },
        select: { emailEncrypted: true, programRole: true },
      }),
  );
  if (!user) {
    return;
  }
  const joinUrl = await getRevealedJoinUrl(
    staffLookup
      ? {
          ...viewer,
          userId: recipientUserId,
          programRole: user.programRole,
          adminRole: "none",
        }
      : viewer,
    eventId,
  );
  await sendEventEmail({
    kind: "event_yes_invite",
    to: decryptPii(user.emailEncrypted),
    vars: {
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      location: event.location ?? "",
      joinUrl: joinUrl ?? "",
    },
  });
}
