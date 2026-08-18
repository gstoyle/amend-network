import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { env } from "@/lib/env";

const MARKER = `dir-vis-${randomUUID()}`;

const CALLER = {
  userId: randomUUID(),
  programRole: "pathways" as const,
  adminRole: "none" as const,
  status: "active" as const,
};

async function insertUser(input: {
  id: string;
  email: string;
  status: "pending" | "active" | "deactivated";
  programRole: "pathways" | "lead";
}): Promise<void> {
  const passwordHash = await hashPassword(env().SEED_PASSWORD);
  await migrator.$executeRaw`
    INSERT INTO users (
      id, email_lookup, email_encrypted, password_hash,
      first_name_encrypted, last_name_encrypted,
      program_role, admin_role, status, directory_visible, updated_at
    ) VALUES (
      ${input.id}::uuid,
      ${Buffer.from(hmacEmailLookup(input.email))},
      ${Buffer.from(encryptPii(input.email))},
      ${passwordHash},
      ${Buffer.from(encryptPii("Dir"))},
      ${Buffer.from(encryptPii("Member"))},
      ${input.programRole}::"ProgramRole",
      'none'::"AdminRole",
      ${input.status}::"UserStatus",
      ${input.status === "active"},
      CURRENT_TIMESTAMP
    )
  `;
}

async function insertListing(userId: string, programRole: "pathways" | "lead"): Promise<void> {
  await migrator.$executeRaw`
    INSERT INTO directory_listings (
      user_id, program_role, network_id,
      first_name_encrypted, last_name_encrypted, created_at, updated_at
    ) VALUES (
      ${userId}::uuid,
      ${programRole}::"ProgramRole",
      ${randomUUID()}::uuid,
      ${Buffer.from(encryptPii("Dir"))},
      ${Buffer.from(encryptPii("Member"))},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
}

async function executeVisible(
  userId: string,
  ctx: {
    userId: string;
    programRole: "pathways";
    adminRole: "none";
    status: "active" | "pending";
  },
): Promise<boolean | null> {
  const rows = await withRls(ctx, async (tx) =>
    tx.$queryRaw<{ directory_listing_visible: boolean }[]>`
      SELECT directory_listing_visible(${userId}::uuid)
    `,
  );
  return rows[0]?.directory_listing_visible ?? null;
}

describe("directory_listing_visible direct EXECUTE as amend_app — contracts/rls-policies.md", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length === 0) {
      return;
    }
    await migrator.$executeRaw`
      DELETE FROM directory_shown_titles WHERE user_id = ANY(${createdUserIds}::uuid[])
    `.catch(() => undefined);
    await migrator.$executeRaw`
      DELETE FROM directory_shown_docs WHERE user_id = ANY(${createdUserIds}::uuid[])
    `.catch(() => undefined);
    await migrator.$executeRaw`
      DELETE FROM directory_shown_emails WHERE user_id = ANY(${createdUserIds}::uuid[])
    `.catch(() => undefined);
    await migrator.$executeRaw`
      DELETE FROM directory_listings WHERE user_id = ANY(${createdUserIds}::uuid[])
    `.catch(() => undefined);
    await migrator.$executeRaw`DELETE FROM users WHERE id = ANY(${createdUserIds}::uuid[])`;
    createdUserIds.length = 0;
  });

  it("same program: EXECUTE true, listings SELECT 1 row, users other rows 0", async () => {
    const peer = randomUUID();
    createdUserIds.push(CALLER.userId, peer);
    await insertUser({
      id: CALLER.userId,
      email: `${MARKER}-caller@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertUser({
      id: peer,
      email: `${MARKER}-peer@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertListing(peer, "pathways");

    expect(await executeVisible(peer, CALLER)).toBe(true);

    const listings = await withRls(CALLER, async (tx) =>
      tx.$queryRaw<{ user_id: string }[]>`
        SELECT user_id FROM directory_listings WHERE user_id = ${peer}::uuid
      `,
    );
    expect(listings).toEqual([{ user_id: peer }]);

    const others = await withRls(CALLER, async (tx) =>
      tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM users WHERE id <> ${CALLER.userId}::uuid
      `,
    );
    expect(others).toEqual([]);
  });

  it("cross program: EXECUTE false, listings SELECT 0, same as missing id", async () => {
    const lead = randomUUID();
    const missing = randomUUID();
    createdUserIds.push(CALLER.userId, lead);
    await insertUser({
      id: CALLER.userId,
      email: `${MARKER}-xcaller@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertUser({
      id: lead,
      email: `${MARKER}-lead@example.com`,
      status: "active",
      programRole: "lead",
    });
    await insertListing(lead, "lead");

    expect(await executeVisible(lead, CALLER)).toBe(false);
    expect(await executeVisible(missing, CALLER)).toBe(false);

    const listings = await withRls(CALLER, async (tx) =>
      tx.$queryRaw<{ user_id: string }[]>`
        SELECT user_id FROM directory_listings WHERE user_id = ${lead}::uuid
      `,
    );
    expect(listings).toEqual([]);
  });

  it("deactivated: EXECUTE false, listings 0, shown-email rows deleted not merely unread", async () => {
    const peer = randomUUID();
    createdUserIds.push(CALLER.userId, peer);
    await insertUser({
      id: CALLER.userId,
      email: `${MARKER}-dcaller@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertUser({
      id: peer,
      email: `${MARKER}-deact@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertListing(peer, "pathways");
    await migrator.$executeRaw`
      INSERT INTO directory_shown_emails (user_id, email_encrypted, updated_at)
      VALUES (${peer}::uuid, ${Buffer.from(encryptPii("shown@example.com"))}, CURRENT_TIMESTAMP)
    `;

    await migrator.$executeRaw`
      UPDATE users SET status = 'deactivated'::"UserStatus", updated_at = CURRENT_TIMESTAMP
      WHERE id = ${peer}::uuid
    `;

    expect(await executeVisible(peer, CALLER)).toBe(false);

    const listings = await withRls(CALLER, async (tx) =>
      tx.$queryRaw<{ user_id: string }[]>`
        SELECT user_id FROM directory_listings WHERE user_id = ${peer}::uuid
      `,
    );
    expect(listings).toEqual([]);

    const shownAsPeer = await withRls(CALLER, async (tx) =>
      tx.$queryRaw<{ user_id: string }[]>`
        SELECT user_id FROM directory_shown_emails WHERE user_id = ${peer}::uuid
      `,
    );
    expect(shownAsPeer).toEqual([]);

    const leftover = await migrator.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM directory_shown_emails WHERE user_id = ${peer}::uuid
    `;
    expect(Number(leftover[0]?.n)).toBe(0);

    const leftoverListing = await migrator.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM directory_listings WHERE user_id = ${peer}::uuid
    `;
    expect(Number(leftoverListing[0]?.n)).toBe(0);
  });

  it("hidden title: SELECT directory_shown_titles for that peer returns 0 rows", async () => {
    const peer = randomUUID();
    createdUserIds.push(CALLER.userId, peer);
    await insertUser({
      id: CALLER.userId,
      email: `${MARKER}-hcaller@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertUser({
      id: peer,
      email: `${MARKER}-hidden@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertListing(peer, "pathways");

    const titles = await withRls(CALLER, async (tx) =>
      tx.$queryRaw<{ user_id: string }[]>`
        SELECT user_id FROM directory_shown_titles WHERE user_id = ${peer}::uuid
      `,
    );
    expect(titles).toEqual([]);
  });

  it("pending viewer: EXECUTE on a live Pathways listing is false", async () => {
    const peer = randomUUID();
    createdUserIds.push(peer);
    await insertUser({
      id: peer,
      email: `${MARKER}-live@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertListing(peer, "pathways");

    expect(
      await executeVisible(peer, {
        userId: randomUUID(),
        programRole: "pathways",
        adminRole: "none",
        status: "pending",
      }),
    ).toBe(false);
  });
});
