import { writeAudit } from "@/lib/audit/write";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { authorizeEventStaff } from "@/lib/events/publish";
import { sendEventAudienceMail } from "@/lib/events/notify";

export type EventCancelInput = {
  ip: string;
  userAgent: string;
};

export type EventCancelResult = { ok: true } | { ok: false; error: string };

export async function cancelEvent(
  session: SessionClaims | null,
  eventId: string,
  input: EventCancelInput,
): Promise<EventCancelResult> {
  const claims = authorizeEventStaff(session);
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
        select: { id: true, title: true, cancelledAt: true },
      });
      if (!existing) {
        return { ok: false as const, error: "Could not cancel this event." };
      }
      if (existing.cancelledAt) {
        return { ok: true as const, alreadyCancelled: true, title: existing.title };
      }

      await tx.event.update({
        where: { id: eventId },
        data: { cancelledAt: new Date() },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: claims.adminRole,
        action: "event_cancelled",
        entityType: "event",
        entityId: eventId,
        ip: input.ip,
        userAgent: input.userAgent,
        severity: "info",
      });
      return { ok: true as const, alreadyCancelled: false, title: existing.title };
    },
  );

  if (!result.ok) {
    return result;
  }
  if (!result.alreadyCancelled) {
    await sendEventAudienceMail(claims, eventId, "event_cancelled", { title: result.title });
  }
  return { ok: true };
}
