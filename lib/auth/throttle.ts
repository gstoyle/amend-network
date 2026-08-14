import { withRls } from "@/lib/db/rls";

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

export type ThrottleResult = {
  locked: boolean;
  justLocked: boolean;
};

export async function isAuthLocked(identifierHash: Uint8Array<ArrayBuffer>): Promise<boolean> {
  return withRls({ authMode: "throttle" }, async (tx) => {
    const row = await tx.authThrottle.findUnique({
      where: { identifierHash },
    });
    return Boolean(row?.lockedUntil && row.lockedUntil > new Date());
  });
}

export async function recordAuthFailure(identifierHash: Uint8Array<ArrayBuffer>): Promise<ThrottleResult> {
  return withRls({ authMode: "throttle" }, async (tx) => {
    const now = new Date();
    const row = await tx.authThrottle.findUnique({
      where: { identifierHash },
    });

    if (row?.lockedUntil && row.lockedUntil > now) {
      return { locked: true, justLocked: false };
    }

    const windowExpired =
      !row ||
      now.getTime() - row.windowStartedAt.getTime() >= WINDOW_MS ||
      Boolean(row.lockedUntil && row.lockedUntil <= now);

    if (!row || windowExpired) {
      if (row) {
        await tx.authThrottle.update({
          where: { identifierHash },
          data: { failedCount: 1, windowStartedAt: now, lockedUntil: null },
        });
      } else {
        await tx.authThrottle.create({
          data: { identifierHash, failedCount: 1, windowStartedAt: now },
        });
      }
      return { locked: false, justLocked: false };
    }

    const nextCount = row.failedCount + 1;
    const justLocked = nextCount >= MAX_FAILURES;
    await tx.authThrottle.update({
      where: { identifierHash },
      data: {
        failedCount: nextCount,
        lockedUntil: justLocked ? new Date(now.getTime() + LOCK_MS) : null,
      },
    });
    return { locked: justLocked, justLocked };
  });
}

export async function clearAuthThrottle(identifierHash: Uint8Array<ArrayBuffer>): Promise<void> {
  await withRls({ authMode: "throttle" }, async (tx) => {
    await tx.authThrottle.updateMany({
      where: { identifierHash },
      data: { failedCount: 0, lockedUntil: null, windowStartedAt: new Date() },
    });
  });
}
