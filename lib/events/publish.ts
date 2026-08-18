import { randomUUID } from "node:crypto";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { AdminRole, SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import {
  assertEventDescription,
  assertEventTitle,
  assertEventWindow,
  assertJoinUrl,
  parseOptionalCapacity,
  parseVisibility,
} from "@/lib/events/validate";

/** PRD §3: Moderator may create/edit/cancel events. Not the announcement admin set. */
export const EVENT_STAFF_ROLES: AdminRole[] = ["admin", "super_admin", "moderator"];

const createSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    visibility: z.array(z.string()),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    timezoneHint: z.string().optional(),
    location: z.string().optional(),
    isVirtual: z.boolean().optional(),
    joinUrl: z.string().optional(),
    capacity: z.union([z.number(), z.string()]).optional().nullable(),
    hostUserId: z.string().uuid().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (!(value.endsAt > value.startsAt)) {
      ctx.addIssue({
        code: "custom",
        message: "End must be after start.",
      });
    }
  });

export type EventWriteInput = {
  title: string;
  description: string;
  visibility: string[];
  startsAt: Date | string;
  endsAt: Date | string;
  timezoneHint?: string;
  location?: string;
  isVirtual?: boolean;
  joinUrl?: string;
  capacity?: number | string | null;
  hostUserId?: string;
  ip: string;
  userAgent: string;
};

export type EventWriteResult = { ok: true; id: string } | { ok: false; error: string };

export function authorizeEventStaff(session: SessionClaims | null): SessionClaims {
  return requireRole(session, { admin: [...EVENT_STAFF_ROLES], mfa: true });
}

function parsedFields(input: EventWriteInput) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not save this event.");
  }
  const title = assertEventTitle(parsed.data.title);
  const description = assertEventDescription(parsed.data.description);
  const visibility = parseVisibility(parsed.data.visibility);
  assertEventWindow(parsed.data.startsAt, parsed.data.endsAt);
  const isVirtual = parsed.data.isVirtual === true;
  const joinUrlRaw = parsed.data.joinUrl?.trim() ?? "";
  if (isVirtual && joinUrlRaw.length === 0) {
    throw new Error("A virtual event needs a join destination.");
  }
  const joinUrl = isVirtual ? assertJoinUrl(joinUrlRaw) : null;
  const location = parsed.data.location?.trim() || null;
  if (location && location.length > 200) {
    throw new Error("Location must be 200 characters or fewer.");
  }
  const timezoneHint = parsed.data.timezoneHint?.trim() || null;
  const hostUserId = parsed.data.hostUserId && parsed.data.hostUserId.length > 0
    ? parsed.data.hostUserId
    : null;
  return {
    title,
    description,
    visibility,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    timezoneHint,
    location,
    isVirtual,
    joinUrl,
    capacity: parseOptionalCapacity(parsed.data.capacity),
    hostUserId,
  };
}

export async function createEvent(
  session: SessionClaims | null,
  input: EventWriteInput,
): Promise<EventWriteResult> {
  const claims = authorizeEventStaff(session);
  let fields;
  try {
    fields = parsedFields(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save this event." };
  }
  const id = randomUUID();
  await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      await tx.event.create({
        data: {
          id,
          title: fields.title,
          description: fields.description,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          timezoneHint: fields.timezoneHint,
          location: fields.location,
          isVirtual: fields.isVirtual,
          capacity: fields.capacity,
          visibility: fields.visibility,
          hostUserId: fields.hostUserId,
          createdBy: claims.userId,
          joinLink: fields.joinUrl ? { create: { url: fields.joinUrl } } : undefined,
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: claims.adminRole,
        action: "event_created",
        entityType: "event",
        entityId: id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { visibility: fields.visibility },
        severity: "info",
      });
    },
  );
  return { ok: true, id };
}

export type AdminEvent = {
  id: string;
  title: string;
  description: string;
  visibility: string[];
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  isVirtual: boolean;
  capacity: number | null;
};

export async function listAdminEvents(session: SessionClaims | null): Promise<AdminEvent[]> {
  const claims = authorizeEventStaff(session);
  const rows = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) => tx.event.findMany({ orderBy: [{ startsAt: "desc" }, { id: "desc" }] }),
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    cancelledAt: row.cancelledAt,
    isVirtual: row.isVirtual,
    capacity: row.capacity,
  }));
}
