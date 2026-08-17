import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";

const MARKER = `evt-promote-${randomUUID()}`;

const CALLER = {
  userId: randomUUID(),
  programRole: "pathways" as const,
  adminRole: "none" as const,
  status: "active" as const,
};

async function insertEvent(input: {
  title: string;
  visibility: string[];
  capacity: number;
}): Promise<string> {
  const id = randomUUID();
  await migrator.$executeRaw`
    INSERT INTO events (
      id, title, description, starts_at, ends_at, is_virtual, capacity, visibility,
      created_by, created_at, updated_at
    ) VALUES (
      ${id}::uuid,
      ${input.title},
      ${"Body for " + input.title},
      CURRENT_TIMESTAMP + interval '2 hours',
      CURRENT_TIMESTAMP + interval '3 hours',
      false,
      ${input.capacity},
      ${`{${input.visibility.join(",")}}`}::text[],
      ${randomUUID()}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return id;
}

async function insertRsvp(input: {
  userId: string;
  eventId: string;
  status: string;
  waitlistedAt?: Date | null;
}): Promise<void> {
  await migrator.$executeRaw`
    INSERT INTO event_rsvps (
      user_id, event_id, status, waitlisted_at, created_at, updated_at
    ) VALUES (
      ${input.userId}::uuid,
      ${input.eventId}::uuid,
      ${input.status},
      ${input.waitlistedAt ?? null},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
}

async function rsvpStatus(eventId: string, userId: string): Promise<string | undefined> {
  const rows = await migrator.$queryRaw<{ status: string }[]>`
    SELECT status FROM event_rsvps
    WHERE event_id = ${eventId}::uuid AND user_id = ${userId}::uuid
  `;
  return rows[0]?.status;
}

describe("event_promote_oldest_waitlist direct EXECUTE as amend_app — contracts/rls-policies.md", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await migrator.$executeRaw`DELETE FROM event_rsvps WHERE event_id = ${id}::uuid`;
      await migrator.$executeRaw`DELETE FROM events WHERE id = ${id}::uuid`;
    }
    createdIds.length = 0;
  });

  it("oldest-only, no target user, that event only", async () => {
    const nargs = await migrator.$queryRaw<{ pronargs: number }[]>`
      SELECT p.pronargs
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'event_promote_oldest_waitlist'
        AND n.nspname = 'public'
    `;
    expect(nargs).toEqual([{ pronargs: 1 }]);

    const y = randomUUID();
    const w1 = randomUUID();
    const w2 = randomUUID();
    const w3 = randomUUID();
    expect(new Set([CALLER.userId, y, w1, w2, w3]).size).toBe(5);

    const ePath = await insertEvent({
      title: `${MARKER}-E_path`,
      visibility: ["pathways"],
      capacity: 1,
    });
    const eOther = await insertEvent({
      title: `${MARKER}-E_other`,
      visibility: ["pathways"],
      capacity: 1,
    });
    createdIds.push(ePath, eOther);

    const older = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-01-02T00:00:00Z");
    await insertRsvp({ userId: y, eventId: ePath, status: "yes" });
    await insertRsvp({ userId: w1, eventId: ePath, status: "waitlist", waitlistedAt: older });
    await insertRsvp({ userId: w2, eventId: ePath, status: "waitlist", waitlistedAt: newer });
    await insertRsvp({ userId: w3, eventId: eOther, status: "waitlist", waitlistedAt: older });

    await migrator.$executeRaw`
      UPDATE event_rsvps SET status = 'no', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${y}::uuid AND event_id = ${ePath}::uuid
    `;

    const promoted = await withRls(CALLER, (tx) =>
      tx.$queryRaw<{ uid: string | null }[]>`
        SELECT event_promote_oldest_waitlist(${ePath}::uuid) AS uid
      `,
    );
    expect(promoted[0]?.uid).toBe(w1);
    expect(await rsvpStatus(ePath, w1)).toBe("yes");
    expect(await rsvpStatus(ePath, w2)).toBe("waitlist");
    expect(await rsvpStatus(eOther, w3)).toBe("waitlist");
    expect(await rsvpStatus(ePath, y)).toBe("no");
  });

  it("cross-cohort is a no-op", async () => {
    const l1 = randomUUID();
    expect(l1).not.toBe(CALLER.userId);

    const eLead = await insertEvent({
      title: `${MARKER}-E_lead`,
      visibility: ["lead"],
      capacity: 1,
    });
    createdIds.push(eLead);
    await insertRsvp({
      userId: l1,
      eventId: eLead,
      status: "waitlist",
      waitlistedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const before = await migrator.$queryRaw<{ xmax: string; status: string }[]>`
      SELECT status, xmax::text AS xmax FROM event_rsvps
      WHERE event_id = ${eLead}::uuid AND user_id = ${l1}::uuid
    `;

    const result = await withRls(CALLER, (tx) =>
      tx.$queryRaw<{ uid: string | null }[]>`
        SELECT event_promote_oldest_waitlist(${eLead}::uuid) AS uid
      `,
    );
    expect(result[0]?.uid).toBeNull();
    expect(await rsvpStatus(eLead, l1)).toBe("waitlist");

    const after = await migrator.$queryRaw<{ xmax: string; status: string }[]>`
      SELECT status, xmax::text AS xmax FROM event_rsvps
      WHERE event_id = ${eLead}::uuid AND user_id = ${l1}::uuid
    `;
    expect(after[0]?.status).toBe("waitlist");
    expect(after[0]?.xmax).toBe(before[0]?.xmax);
  });

  it("no free seat is a genuine no-op", async () => {
    const y = randomUUID();
    const w1 = randomUUID();
    const w2 = randomUUID();
    expect(new Set([CALLER.userId, y, w1, w2]).size).toBe(4);

    const ePath = await insertEvent({
      title: `${MARKER}-full`,
      visibility: ["pathways"],
      capacity: 1,
    });
    createdIds.push(ePath);
    await insertRsvp({ userId: y, eventId: ePath, status: "yes" });
    await insertRsvp({
      userId: w1,
      eventId: ePath,
      status: "waitlist",
      waitlistedAt: new Date("2026-01-01T00:00:00Z"),
    });
    await insertRsvp({
      userId: w2,
      eventId: ePath,
      status: "waitlist",
      waitlistedAt: new Date("2026-01-02T00:00:00Z"),
    });

    const before = await migrator.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM event_rsvps
      WHERE event_id = ${ePath}::uuid AND status = 'waitlist'
    `;
    expect(Number(before[0]?.n)).toBe(2);

    const result = await withRls(CALLER, (tx) =>
      tx.$queryRaw<{ uid: string | null }[]>`
        SELECT event_promote_oldest_waitlist(${ePath}::uuid) AS uid
      `,
    );
    expect(result[0]?.uid).toBeNull();
    expect(await rsvpStatus(ePath, y)).toBe("yes");
    expect(await rsvpStatus(ePath, w1)).toBe("waitlist");
    expect(await rsvpStatus(ePath, w2)).toBe("waitlist");

    const after = await migrator.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM event_rsvps
      WHERE event_id = ${ePath}::uuid AND status = 'waitlist'
    `;
    expect(Number(after[0]?.n)).toBe(2);
  });
});
