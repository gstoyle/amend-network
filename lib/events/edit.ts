import { writeAudit } from "@/lib/audit/write";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { sendEventAudienceMail } from "@/lib/events/notify";
import {
  authorizeEventStaff,
  parseEventWriteFields,
  type EventWriteInput,
  type EventWriteResult,
} from "@/lib/events/publish";

const CAPACITY_SHRINK_MESSAGE =
  "Capacity is below the current Yes count. Confirm to save without changing existing Yes RSVPs.";

export type EventEditInput = EventWriteInput & {
  notifyRsvps?: boolean;
  notifyMessage?: string;
  confirmCapacityShrink?: boolean;
};

export async function updateEvent(
  session: SessionClaims | null,
  eventId: string,
  input: EventEditInput,
): Promise<EventWriteResult> {
  const claims = authorizeEventStaff(session);
  let fields;
  try {
    fields = parseEventWriteFields(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save this event." };
  }

  const result = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const existing = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, startsAt: true, endsAt: true, title: true, location: true },
      });
      if (!existing) {
        return { ok: false as const, error: "Could not save this event." };
      }

      const yesCount = await tx.eventRsvp.count({
        where: { eventId, status: "yes" },
      });
      const rsvpCount = await tx.eventRsvp.count({ where: { eventId } });
      if (
        fields.capacity !== null &&
        yesCount > fields.capacity &&
        input.confirmCapacityShrink !== true
      ) {
        return { ok: false as const, error: CAPACITY_SHRINK_MESSAGE };
      }

      const timesChanged =
        existing.startsAt.getTime() !== fields.startsAt.getTime() ||
        existing.endsAt.getTime() !== fields.endsAt.getTime();

      await tx.event.update({
        where: { id: eventId },
        data: {
          title: fields.title,
          description: fields.description,
          visibility: fields.visibility,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          timezoneHint: fields.timezoneHint,
          location: fields.location,
          isVirtual: fields.isVirtual,
          capacity: fields.capacity,
          hostUserId: fields.hostUserId,
        },
      });

      if (fields.joinUrl) {
        await tx.eventJoinLink.upsert({
          where: { eventId },
          create: { eventId, url: fields.joinUrl },
          update: { url: fields.joinUrl },
        });
      } else {
        const existingLink = await tx.eventJoinLink.findUnique({
          where: { eventId },
          select: { eventId: true },
        });
        if (existingLink) {
          await tx.eventJoinLink.delete({ where: { eventId } });
        }
      }

      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: claims.adminRole,
        action: "event_edited",
        entityType: "event",
        entityId: eventId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { timesChanged },
        severity: "info",
      });

      return {
        ok: true as const,
        timesChanged,
        rsvpCount,
        title: fields.title,
        startsAt: fields.startsAt,
        location: fields.location,
      };
    },
  );

  if (!result.ok) {
    return result;
  }

  if (result.timesChanged && input.notifyRsvps === true && result.rsvpCount > 0) {
    await sendEventAudienceMail(claims, eventId, "event_time_changed", {
      title: result.title,
      startsAt: result.startsAt.toISOString(),
      location: result.location ?? undefined,
      message: input.notifyMessage,
    });
  }

  return { ok: true, id: eventId };
}
