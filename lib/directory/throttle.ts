import type { Prisma } from "@prisma/client";

const WINDOW_MS = 60_000;
const CAP = 30;

export const DIRECTORY_SEARCH_TRY_LATER = "Try again later.";

export async function consumeDirectorySearch(
  tx: Prisma.TransactionClient,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const row = await tx.directorySearchThrottle.findUnique({
    where: { userId },
    select: { searchCount: true, windowStartedAt: true },
  });

  if (!row || now.getTime() - row.windowStartedAt.getTime() >= WINDOW_MS) {
    if (row) {
      await tx.$executeRaw`
        UPDATE directory_search_throttle
        SET window_started_at = ${now}, search_count = 1
        WHERE user_id = ${userId}::uuid
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO directory_search_throttle (user_id, window_started_at, search_count)
        VALUES (${userId}::uuid, ${now}, 1)
      `;
    }
    return true;
  }

  if (row.searchCount >= CAP) {
    return false;
  }

  const updated = await tx.$executeRaw`
    UPDATE directory_search_throttle
    SET search_count = search_count + 1
    WHERE user_id = ${userId}::uuid
      AND search_count < ${CAP}
  `;
  return Number(updated) > 0;
}
