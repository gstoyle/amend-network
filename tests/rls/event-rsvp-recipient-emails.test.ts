import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { decryptPii, encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";

const MARKER = `evt-rcpt-${randomUUID()}`;

const STAFF = {
  userId: randomUUID(),
  programRole: "none" as const,
  adminRole: "admin" as const,
  status: "active" as const,
};

const PATHWAYS = {
  userId: randomUUID(),
  programRole: "pathways" as const,
  adminRole: "none" as const,
  status: "active" as const,
};

async function insertEvent(title: string): Promise<string> {
  const id = randomUUID();
  const startsAt = new Date(Date.now() + 2 * 60 * 60_000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  await migrator.$executeRaw`
    INSERT INTO events (
      id, title, description, starts_at, ends_at, is_virtual, visibility,
      created_by, created_at, updated_at
    ) VALUES (
      ${id}::uuid,
      ${title},
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

async function insertUser(email: string): Promise<string> {
  const id = randomUUID();
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(email),
      emailEncrypted: encryptPii(email),
      passwordHash: "unused-test-hash",
      firstNameEncrypted: encryptPii("Test"),
      lastNameEncrypted: encryptPii("Member"),
      programRole: "pathways",
      adminRole: "none",
      status: "active",
    },
  });
  return id;
}

describe("event_rsvp_recipient_emails (direct EXECUTE, one event_id)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("staff sees only that event's RSVP emails; other events and non-staff are empty", async () => {
    const eventA = await insertEvent(`${MARKER}-a`);
    const eventB = await insertEvent(`${MARKER}-b`);
    const emailAYes = `${MARKER}-a-yes@example.test`;
    const emailAMaybe = `${MARKER}-a-maybe@example.test`;
    const emailB = `${MARKER}-b@example.test`;
    const userAYes = await insertUser(emailAYes);
    const userAMaybe = await insertUser(emailAMaybe);
    const userB = await insertUser(emailB);
    createdUserIds.push(userAYes, userAMaybe, userB);

    await migrator.$executeRaw`
      INSERT INTO event_rsvps (user_id, event_id, status, created_at, updated_at)
      VALUES
        (${userAYes}::uuid, ${eventA}::uuid, 'yes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (${userAMaybe}::uuid, ${eventA}::uuid, 'maybe', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (${userB}::uuid, ${eventB}::uuid, 'yes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const staffA = await withRls(STAFF, (tx) =>
      tx.$queryRaw<{ email_encrypted: Uint8Array }[]>`
        SELECT email_encrypted FROM event_rsvp_recipient_emails(${eventA}::uuid)
      `,
    );
    const decrypted = staffA.map((row) => decryptPii(row.email_encrypted)).sort();
    expect(decrypted).toEqual([emailAMaybe, emailAYes].sort());

    const pathwaysA = await withRls(PATHWAYS, (tx) =>
      tx.$queryRaw<{ email_encrypted: Uint8Array }[]>`
        SELECT email_encrypted FROM event_rsvp_recipient_emails(${eventA}::uuid)
      `,
    );
    expect(pathwaysA).toEqual([]);
  });
});
