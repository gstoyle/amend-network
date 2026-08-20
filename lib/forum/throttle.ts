import type { Prisma } from "@prisma/client";
import { FORUM_RATE_LIMIT_MESSAGE } from "@/lib/forum/validate";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * 60_000;
const THREAD_PER_MINUTE = 1;
const POST_PER_MINUTE = 5;
const POST_PER_HOUR = 30;

export async function consumeForumQuota(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: "thread" | "post",
  now = new Date(),
): Promise<void> {
  const row = await tx.forumPostThrottle.findUnique({ where: { userId } });
  const minuteElapsed = !row || now.getTime() - row.windowStartedAt.getTime() >= MINUTE_MS;
  const threadElapsed =
    !row || now.getTime() - row.threadWindowStartedAt.getTime() >= MINUTE_MS;
  const hourElapsed = !row || now.getTime() - row.hourWindowStartedAt.getTime() >= HOUR_MS;

  const postCount = minuteElapsed ? 0 : row.postCount;
  const threadCount = threadElapsed ? 0 : row.threadCount;
  const hourCount = hourElapsed ? 0 : row.hourCount;

  if (kind === "thread" && threadCount >= THREAD_PER_MINUTE) {
    throw new Error(FORUM_RATE_LIMIT_MESSAGE);
  }
  if (kind === "post" && (postCount >= POST_PER_MINUTE || hourCount >= POST_PER_HOUR)) {
    throw new Error(FORUM_RATE_LIMIT_MESSAGE);
  }

  const nextPost = postCount + (kind === "post" ? 1 : 0);
  const nextThread = threadCount + (kind === "thread" ? 1 : 0);
  const nextHour = hourCount + (kind === "post" ? 1 : 0);
  const windowStartedAt = minuteElapsed ? now : row!.windowStartedAt;
  const threadWindowStartedAt = threadElapsed ? now : row!.threadWindowStartedAt;
  const hourWindowStartedAt = hourElapsed ? now : row!.hourWindowStartedAt;

  if (!row) {
    await tx.forumPostThrottle.create({
      data: {
        userId,
        windowStartedAt,
        postCount: nextPost,
        threadWindowStartedAt,
        threadCount: nextThread,
        hourWindowStartedAt,
        hourCount: nextHour,
      },
    });
    return;
  }

  await tx.forumPostThrottle.update({
    where: { userId },
    data: {
      windowStartedAt,
      postCount: nextPost,
      threadWindowStartedAt,
      threadCount: nextThread,
      hourWindowStartedAt,
      hourCount: nextHour,
    },
  });
}
