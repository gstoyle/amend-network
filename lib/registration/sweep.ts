import { writeAudit } from "@/lib/audit/write";
import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { sendLifecycleEmail } from "@/lib/email/transport";

const REMINDER_MS = 3 * 24 * 60 * 60 * 1000;
const SWEEP_IP = "127.0.0.1";
const SWEEP_USER_AGENT = "invitation-sweep";

export type InvitationSweepResult = {
  expired: number;
  reminded: number;
};

type OutboundMail = {
  kind: "invite_expiring_soon" | "invite_expired";
  to: string;
};

export async function runInvitationSweep(now: Date = new Date()): Promise<InvitationSweepResult> {
  const outbound: OutboundMail[] = [];
  let expired = 0;
  let reminded = 0;

  await withRls({ adminRole: "admin", status: "active" }, async (tx) => {
    const due = await tx.invitation.findMany({
      where: { status: "pending", expiresAt: { lte: now } },
    });
    for (const row of due) {
      const updated = await tx.invitation.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "expired" },
      });
      if (updated.count !== 1) {
        continue;
      }
      expired += 1;
      await writeAudit(tx, {
        actorRole: "system",
        action: "invitation_expired",
        entityType: "invitation",
        entityId: row.id,
        ip: SWEEP_IP,
        userAgent: SWEEP_USER_AGENT,
        severity: "info",
      });
      const inviter = await tx.user.findUnique({
        where: { id: row.inviterId },
        select: { emailEncrypted: true },
      });
      if (inviter) {
        outbound.push({ kind: "invite_expired", to: decryptPii(inviter.emailEncrypted) });
      }
    }

    const reminderCutoff = new Date(now.getTime() + REMINDER_MS);
    const upcoming = await tx.invitation.findMany({
      where: {
        status: "pending",
        expiryReminderSentAt: null,
        expiresAt: { gt: now, lte: reminderCutoff },
      },
    });
    for (const row of upcoming) {
      const updated = await tx.invitation.updateMany({
        where: { id: row.id, status: "pending", expiryReminderSentAt: null },
        data: { expiryReminderSentAt: now },
      });
      if (updated.count !== 1) {
        continue;
      }
      reminded += 1;
      const invitee = decryptPii(row.emailEncrypted);
      outbound.push({ kind: "invite_expiring_soon", to: invitee });
      const inviter = await tx.user.findUnique({
        where: { id: row.inviterId },
        select: { emailEncrypted: true },
      });
      if (inviter) {
        const inviterEmail = decryptPii(inviter.emailEncrypted);
        if (inviterEmail !== invitee) {
          outbound.push({ kind: "invite_expiring_soon", to: inviterEmail });
        }
      }
    }
  });

  for (const mail of outbound) {
    await sendLifecycleEmail({ kind: mail.kind, to: mail.to });
  }

  return { expired, reminded };
}
