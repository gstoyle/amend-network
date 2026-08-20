import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { rlsContext } from "@/lib/forum/staff";
import {
  forumUnsubscribeTokenValid,
} from "@/lib/forum/notify";

export async function subscribeToThread(
  session: SessionClaims | null,
  threadId: string,
): Promise<void> {
  const claims = requireRole(session);
  await withRls(rlsContext(claims), async (tx) => {
    await tx.forumSubscription.upsert({
      where: { userId_threadId: { userId: claims.userId, threadId } },
      create: { userId: claims.userId, threadId },
      update: {},
    });
  });
}

export async function unsubscribeFromThread(
  session: SessionClaims | null,
  threadId: string,
): Promise<void> {
  const claims = requireRole(session);
  await withRls(rlsContext(claims), async (tx) => {
    await tx.forumSubscription.deleteMany({
      where: { userId: claims.userId, threadId },
    });
  });
}

export async function unsubscribeWithToken(
  userId: string,
  threadId: string,
  token: string,
): Promise<boolean> {
  if (!forumUnsubscribeTokenValid(userId, threadId, token)) {
    return false;
  }
  await withRls({ userId, status: "active" }, async (tx) => {
    await tx.forumSubscription.deleteMany({ where: { userId, threadId } });
  });
  return true;
}
