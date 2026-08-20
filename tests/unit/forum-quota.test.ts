import { describe, expect, it } from "vitest";
import { consumeForumQuota } from "@/lib/forum/throttle";
import { FORUM_RATE_LIMIT_MESSAGE } from "@/lib/forum/validate";

type ThrottleRow = {
  userId: string;
  windowStartedAt: Date;
  postCount: number;
  threadWindowStartedAt: Date;
  threadCount: number;
  hourWindowStartedAt: Date;
  hourCount: number;
};

function fakeTx(store: { row: ThrottleRow | null }) {
  return {
    forumPostThrottle: {
      findUnique: async () => store.row,
      create: async ({ data }: { data: ThrottleRow }) => {
        store.row = data;
      },
      update: async ({ data }: { data: Partial<ThrottleRow> }) => {
        store.row = { ...store.row!, ...data };
      },
    },
  };
}

describe("forum quota", () => {
  it("allows the first thread and refuses a second in the same minute", async () => {
    const store = { row: null as ThrottleRow | null };
    const tx = fakeTx(store) as never;
    const now = new Date("2026-08-19T12:00:00.000Z");
    await consumeForumQuota(tx, "user-1", "thread", now);
    await expect(consumeForumQuota(tx, "user-1", "thread", now)).rejects.toThrowError(
      FORUM_RATE_LIMIT_MESSAGE,
    );
  });

  it("refuses a sixth post in the same minute", async () => {
    const store = { row: null as ThrottleRow | null };
    const tx = fakeTx(store) as never;
    const now = new Date("2026-08-19T12:00:00.000Z");
    for (let i = 0; i < 5; i += 1) {
      await consumeForumQuota(tx, "user-1", "post", now);
    }
    await expect(consumeForumQuota(tx, "user-1", "post", now)).rejects.toThrowError(
      FORUM_RATE_LIMIT_MESSAGE,
    );
  });

  it("resets the thread window after a minute", async () => {
    const store = { row: null as ThrottleRow | null };
    const tx = fakeTx(store) as never;
    const now = new Date("2026-08-19T12:00:00.000Z");
    await consumeForumQuota(tx, "user-1", "thread", now);
    await consumeForumQuota(tx, "user-1", "thread", new Date(now.getTime() + 60_000));
    expect(store.row?.threadCount).toBe(1);
  });
});
