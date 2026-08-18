import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";

const MARKER = `evt-mark-rem-${randomUUID()}`;

const STAFF = {
  userId: randomUUID(),
  programRole: "none" as const,
  adminRole: "admin" as const,
  status: "active" as const,
};

async function insertEvent(startsAt: Date): Promise<string> {
  const id = randomUUID();
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  await migrator.$executeRaw`
    INSERT INTO events (
      id, title, description, starts_at, ends_at, is_virtual, visibility,
      created_by, created_at, updated_at
    ) VALUES (
      ${id}::uuid,
      ${`${MARKER}-out`},
      ${"Body"},
      ${startsAt},
      ${endsAt},
      false,
      '{all_authenticated}'::text[],
      ${randomUUID()}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return id;
}

describe("event_mark_reminder_sent window binding (direct EXECUTE)", () => {
  const createdIds: string[] = [];
  const userIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await migrator.$executeRaw`DELETE FROM event_rsvps WHERE event_id = ${id}::uuid`;
      await migrator.$executeRaw`DELETE FROM events WHERE id = ${id}::uuid`;
    }
    createdIds.length = 0;
    userIds.length = 0;
  });

  it("staff GUC on a Yes RSVP whose event is outside the 24h window returns false and does not stamp reminder_sent_at", async () => {
    const userId = randomUUID();
    userIds.push(userId);
    const startsAt = new Date(Date.now() + 48 * 60 * 60_000);
    const eventId = await insertEvent(startsAt);
    createdIds.push(eventId);
    await migrator.$executeRaw`
      INSERT INTO event_rsvps (user_id, event_id, status, created_at, updated_at)
      VALUES (${userId}::uuid, ${eventId}::uuid, 'yes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const result = await withRls(STAFF, (tx) =>
      tx.$queryRaw<{ event_mark_reminder_sent: boolean }[]>`
        SELECT event_mark_reminder_sent(${eventId}::uuid, ${userId}::uuid) AS event_mark_reminder_sent
      `,
    );
    expect(result[0]?.event_mark_reminder_sent).toBe(false);

    const row = await migrator.$queryRaw<{ reminder_sent_at: Date | null }[]>`
      SELECT reminder_sent_at FROM event_rsvps
      WHERE event_id = ${eventId}::uuid AND user_id = ${userId}::uuid
    `;
    expect(row[0]?.reminder_sent_at).toBeNull();
  });
});
