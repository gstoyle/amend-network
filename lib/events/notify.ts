import type { SessionClaims } from "@/lib/auth/types";
import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { sendEventEmail, type EventEmailKind } from "@/lib/email/transport";

export type EventMailVars = {
  title: string;
  startsAt?: string;
  location?: string;
  message?: string;
  joinUrl?: string;
};

export async function loadEventRsvpRecipientEmails(
  session: SessionClaims,
  eventId: string,
): Promise<string[]> {
  const rows = await withRls(
    {
      userId: session.userId,
      programRole: session.programRole,
      adminRole: session.adminRole,
      status: session.status,
    },
    (tx) =>
      tx.$queryRaw<{ email_encrypted: Uint8Array }[]>`
        SELECT email_encrypted FROM event_rsvp_recipient_emails(${eventId}::uuid)
      `,
  );
  return rows.map((row) => decryptPii(row.email_encrypted));
}

export async function sendEventAudienceMail(
  session: SessionClaims,
  eventId: string,
  kind: EventEmailKind,
  vars: EventMailVars,
): Promise<void> {
  const recipients = await loadEventRsvpRecipientEmails(session, eventId);
  for (const to of recipients) {
    await sendEventEmail({ kind, to, vars });
  }
}
