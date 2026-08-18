import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { sendEventEmail } from "@/lib/email/transport";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type EventReminderResult = {
  reminded: number;
};

type OutboundMail = {
  to: string;
  title: string;
  startsAt: Date;
};

export async function runEventReminders(now: Date = new Date()): Promise<EventReminderResult> {
  const cutoff = new Date(now.getTime() + WINDOW_MS);
  const outbound: OutboundMail[] = [];

  await withRls({ adminRole: "admin", status: "active" }, async (tx) => {
    const due = await tx.event.findMany({
      where: {
        cancelledAt: null,
        startsAt: { gt: now, lte: cutoff },
      },
      select: { id: true, title: true, startsAt: true },
    });
    for (const event of due) {
      const rsvps = await tx.eventRsvp.findMany({
        where: { eventId: event.id, status: "yes", reminderSentAt: null },
        select: { userId: true },
      });
      for (const rsvp of rsvps) {
        const marked = await tx.$queryRaw<{ event_mark_reminder_sent: boolean }[]>`
          SELECT event_mark_reminder_sent(
            ${event.id}::uuid,
            ${rsvp.userId}::uuid,
            ${now}::timestamptz
          ) AS event_mark_reminder_sent
        `;
        if (!marked[0]?.event_mark_reminder_sent) {
          continue;
        }
        const user = await tx.user.findUnique({
          where: { id: rsvp.userId },
          select: { emailEncrypted: true },
        });
        if (!user) {
          continue;
        }
        outbound.push({
          to: decryptPii(user.emailEncrypted),
          title: event.title,
          startsAt: event.startsAt,
        });
      }
    }
  });

  for (const mail of outbound) {
    await sendEventEmail({
      kind: "event_reminder",
      to: mail.to,
      vars: {
        title: mail.title,
        startsAt: mail.startsAt.toISOString(),
      },
    });
  }

  return { reminded: outbound.length };
}
