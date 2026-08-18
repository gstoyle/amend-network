import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { track, type AnalyticsRsvpStatus } from "@/lib/analytics/track";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { visibilityTokens } from "@/lib/db/visibility";

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
 * Choice (a): two-arg advisory lock, no extra events column.
 * Postgres has pg_advisory_xact_lock(bigint) and pg_advisory_xact_lock(int, int)
 * (the pair is one 64-bit lock id). There is no (bigint, bigint) overload.
 * Two hashtext salts, not a single hashtextextended pass.
 */
export async function acquireEventRsvpLock(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<void> {
  await tx.$queryRaw<{ locked: string }[]>`
    SELECT pg_advisory_xact_lock(
      hashtext(${eventId}::text || chr(1)),
      hashtext(${eventId}::text || chr(2))
    )::text AS locked
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

      return { ok: true, status: nextStatus, promotedUserId } as const;
    },
  );

  if (!result.ok) {
    return { ok: false };
  }

  trackRsvp(claims, eventId, result.status);
  if (result.promotedUserId) {
    trackRsvp(claims, eventId, "yes", result.promotedUserId);
  }
  return { ok: true, status: result.status };
}
