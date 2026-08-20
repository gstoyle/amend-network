import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionClaims } from "@/lib/auth/types";
import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { sendForumEmail } from "@/lib/email/transport";
import { env } from "@/lib/env";
import { rlsContext } from "@/lib/forum/staff";

function baseUrl(): string {
  return env().AUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export function forumUnsubscribeToken(userId: string, threadId: string): string {
  return createHmac("sha256", env().AUTH_SECRET)
    .update(`forum-unsub:${userId}:${threadId}`)
    .digest("hex");
}

export function forumUnsubscribeTokenValid(
  userId: string,
  threadId: string,
  token: string,
): boolean {
  const expected = Buffer.from(forumUnsubscribeToken(userId, threadId), "hex");
  const got = Buffer.from(token, "hex");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export async function notifyThreadSubscribers(
  actor: SessionClaims,
  threadId: string,
): Promise<void> {
  try {
    const payload = await withRls(rlsContext(actor), async (tx) => {
      const thread = await tx.forumThread.findUnique({
        where: { id: threadId },
        select: { id: true, title: true },
      });
      if (!thread) {
        return [];
      }
      const rows = await tx.$queryRaw<{ user_id: string; email_encrypted: Uint8Array }[]>`
        SELECT user_id, email_encrypted FROM forum_thread_subscriber_emails(${threadId}::uuid)
      `;
      return rows.map((row) => ({
        userId: row.user_id,
        email: decryptPii(row.email_encrypted),
        title: thread.title,
        threadId: thread.id,
      }));
    });
    for (const row of payload) {
      if (row.userId === actor.userId) {
        continue;
      }
      const token = forumUnsubscribeToken(row.userId, threadId);
      const unsub = `${baseUrl()}/forum/unsubscribe?user=${row.userId}&thread=${threadId}&token=${token}`;
      await sendForumEmail({
        to: row.email,
        subject: `New post in a thread you follow`,
        text: `There is a new post in a discussion you follow.\n${baseUrl()}/app/forum/t/${threadId}\n\nUnsubscribe: ${unsub}`,
      });
    }
  } catch {
    return;
  }
}
