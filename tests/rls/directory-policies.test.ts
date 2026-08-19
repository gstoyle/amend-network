import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { env } from "@/lib/env";

const MARKER = `dir-pol-${randomUUID()}`;

function isRlsDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /row-level security policy|permission denied/i.test(message);
}

async function insertUser(input: {
  id: string;
  email: string;
  status: "pending" | "active";
  programRole: "pathways" | "lead";
}): Promise<void> {
  const passwordHash = await hashPassword(env().SEED_PASSWORD);
  await migrator.$executeRaw`
    INSERT INTO users (
      id, email_lookup, email_encrypted, password_hash,
      first_name_encrypted, last_name_encrypted,
      program_role, admin_role, status, updated_at
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
      CURRENT_TIMESTAMP
    )
  `;
}

async function insertListing(userId: string, programRole: "pathways" | "lead"): Promise<void> {
  const networkId = randomUUID();
  await migrator.$executeRaw`
    INSERT INTO directory_listings (
      user_id, program_role, network_id,
      first_name_encrypted, last_name_encrypted, created_at, updated_at
    ) VALUES (
      ${userId}::uuid,
      ${programRole}::"ProgramRole",
      ${networkId}::uuid,
      ${Buffer.from(encryptPii("Dir"))},
      ${Buffer.from(encryptPii("Member"))},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
}

describe("directory RLS (GUCs only, no requireRole) — contracts/rls-policies.md", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length === 0) {
      return;
    }
    await migrator.$executeRaw`
      DELETE FROM directory_search_throttle WHERE user_id = ANY(${createdUserIds}::uuid[])
    `.catch(() => undefined);
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

  it("own-row INSERT/UPDATE/DELETE on listings and shown-field tables; other user denied", async () => {
    const owner = randomUUID();
    const other = randomUUID();
    createdUserIds.push(owner, other);
    await insertUser({
      id: owner,
      email: `${MARKER}-owner@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertUser({
      id: other,
      email: `${MARKER}-other@example.com`,
      status: "active",
      programRole: "pathways",
    });

    const ctx = {
      userId: owner,
      programRole: "pathways",
      adminRole: "none",
      status: "active",
    };

    await withRls(ctx, async (tx) => {
      await tx.$executeRaw`
        INSERT INTO directory_listings (
          user_id, program_role, network_id,
          first_name_encrypted, last_name_encrypted, created_at, updated_at
        ) VALUES (
          ${owner}::uuid,
          'pathways'::"ProgramRole",
          ${randomUUID()}::uuid,
          ${Buffer.from(encryptPii("Dir"))},
          ${Buffer.from(encryptPii("Member"))},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      await tx.$executeRaw`
        INSERT INTO directory_shown_titles (user_id, title_encrypted, updated_at)
        VALUES (${owner}::uuid, ${Buffer.from(encryptPii("Coach"))}, CURRENT_TIMESTAMP)
      `;
    });

    await expect(
      withRls(ctx, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO directory_listings (
            user_id, program_role, network_id,
            first_name_encrypted, last_name_encrypted, created_at, updated_at
          ) VALUES (
            ${other}::uuid,
            'pathways'::"ProgramRole",
            ${randomUUID()}::uuid,
            ${Buffer.from(encryptPii("Dir"))},
            ${Buffer.from(encryptPii("Member"))},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toSatisfy(isRlsDenied);

    await withRls(ctx, async (tx) => {
      await tx.$executeRaw`
        UPDATE directory_listings SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ${owner}::uuid
      `;
      await tx.$executeRaw`DELETE FROM directory_shown_titles WHERE user_id = ${owner}::uuid`;
      await tx.$executeRaw`DELETE FROM directory_listings WHERE user_id = ${owner}::uuid`;
    });
  });

  it("SELECT listings as Pathways sees same-program rows; pending viewer sees 0", async () => {
    const pathways = randomUUID();
    const lead = randomUUID();
    createdUserIds.push(pathways, lead);
    await insertUser({
      id: pathways,
      email: `${MARKER}-path@example.com`,
      status: "active",
      programRole: "pathways",
    });
    await insertUser({
      id: lead,
      email: `${MARKER}-lead@example.com`,
      status: "active",
      programRole: "lead",
    });
    await insertListing(pathways, "pathways");
    await insertListing(lead, "lead");

    const seen = await withRls(
      {
        userId: randomUUID(),
        programRole: "pathways",
        adminRole: "none",
        status: "active",
      },
      async (tx) =>
        tx.$queryRaw<{ user_id: string }[]>`
          SELECT user_id FROM directory_listings
        `,
    );
    expect(seen.map((row) => row.user_id)).toContain(pathways);
    expect(seen.map((row) => row.user_id)).not.toContain(lead);

    const pendingSeen = await withRls(
      {
        userId: randomUUID(),
        programRole: "pathways",
        adminRole: "none",
        status: "pending",
      },
      async (tx) =>
        tx.$queryRaw<{ user_id: string }[]>`
          SELECT user_id FROM directory_listings
        `,
    );
    expect(pendingSeen).toEqual([]);
  });

  it("throttle is own-row SELECT/INSERT/UPDATE; DELETE is revoked", async () => {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await insertUser({
      id: userId,
      email: `${MARKER}-thr@example.com`,
      status: "active",
      programRole: "pathways",
    });
    const ctx = {
      userId,
      programRole: "pathways",
      adminRole: "none",
      status: "active",
    };

    await withRls(ctx, async (tx) => {
      await tx.$executeRaw`
        INSERT INTO directory_search_throttle (user_id, window_started_at, search_count)
        VALUES (${userId}::uuid, CURRENT_TIMESTAMP, 1)
      `;
      await tx.$executeRaw`
        UPDATE directory_search_throttle SET search_count = 2 WHERE user_id = ${userId}::uuid
      `;
    });

    await expect(
      withRls(ctx, async (tx) => {
        await tx.$executeRaw`DELETE FROM directory_search_throttle WHERE user_id = ${userId}::uuid`;
      }),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("listings and shown-field SELECT policies call directory_listing_visible; users_select is unchanged", async () => {
    const policies = await migrator.$queryRaw<
      { tablename: string; policyname: string; cmd: string; qual: string | null }[]
    >`
      SELECT tablename, policyname, cmd, qual::text AS qual
      FROM pg_policies
      WHERE tablename IN (
        'directory_listings',
        'directory_shown_titles',
        'directory_shown_docs',
        'directory_shown_emails',
        'users'
      )
    `;

    for (const table of [
      "directory_listings",
      "directory_shown_titles",
      "directory_shown_docs",
      "directory_shown_emails",
    ]) {
      const select = policies.find(
        (row) =>
          row.tablename === table &&
          row.cmd === "SELECT" &&
          !row.policyname.includes("retention"),
      );
      expect(select?.qual).toMatch(/directory_listing_visible/i);
      expect(select?.qual).not.toMatch(/app\.admin_role/i);
      expect(select?.qual).not.toMatch(/app_role_tokens\(\)/i);
      const retentionSelect = policies.find(
        (row) =>
          row.tablename === table &&
          row.cmd === "SELECT" &&
          row.policyname.includes("retention"),
      );
      expect(retentionSelect?.qual).toMatch(/app\.auth_mode/i);
      expect(retentionSelect?.qual).toMatch(/retention/);
    }

    const usersSelect = policies.find(
      (row) => row.tablename === "users" && row.policyname === "users_select",
    );
    expect(usersSelect?.qual).toMatch(/credential_lookup/);
    expect(usersSelect?.qual).not.toMatch(/directory_listing/i);
  });
});
