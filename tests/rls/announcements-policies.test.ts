import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";

const MARKER = `ann-rls-${randomUUID()}`;

function isRlsDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /row-level security policy|permission denied/i.test(message);
}

async function insertAnnouncement(input: {
  headline: string;
  visibility: string[];
  activatesAt?: Date;
  expiresAt?: Date;
  deletedAt?: Date | null;
  dismissible?: boolean;
}): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  const activatesAt = input.activatesAt ?? new Date(now.getTime() - 60_000);
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + 60 * 60_000);
  const visibilityLiteral = `{${input.visibility.join(",")}}`;
  await migrator.$executeRaw`
    INSERT INTO announcements (
      id, headline, body, activates_at, expires_at, visibility, dismissible,
      created_by, created_at, updated_at, deleted_at
    ) VALUES (
      ${id}::uuid,
      ${input.headline},
      ${"Body for " + input.headline},
      ${activatesAt},
      ${expiresAt},
      ${visibilityLiteral}::text[],
      ${input.dismissible ?? true},
      ${randomUUID()}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      ${input.deletedAt ?? null}
    )
  `;
  return id;
}

describe("announcements RLS (GUCs only, no requireRole) — contracts/rls-policies.md", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await migrator.$executeRaw`DELETE FROM announcement_cta_clicks WHERE announcement_id = ${id}::uuid`;
      await migrator.$executeRaw`DELETE FROM announcement_impressions WHERE announcement_id = ${id}::uuid`;
      await migrator.$executeRaw`DELETE FROM announcement_dismissals WHERE announcement_id = ${id}::uuid`;
      await migrator.$executeRaw`DELETE FROM announcements WHERE id = ${id}::uuid`;
    }
    createdIds.length = 0;
  });

  it("pathways selects all_authenticated and pathways in-window live rows, not lead/scheduled/expired/withdrawn", async () => {
    const shared = await insertAnnouncement({
      headline: `${MARKER}-shared`,
      visibility: ["all_authenticated"],
    });
    const pathways = await insertAnnouncement({
      headline: `${MARKER}-pathways`,
      visibility: ["pathways"],
    });
    const lead = await insertAnnouncement({
      headline: `${MARKER}-lead`,
      visibility: ["lead"],
    });
    const scheduled = await insertAnnouncement({
      headline: `${MARKER}-scheduled`,
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() + 60 * 60_000),
      expiresAt: new Date(Date.now() + 2 * 60 * 60_000),
    });
    const expired = await insertAnnouncement({
      headline: `${MARKER}-expired`,
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() - 2 * 60 * 60_000),
      expiresAt: new Date(Date.now() - 60_000),
    });
    const withdrawn = await insertAnnouncement({
      headline: `${MARKER}-withdrawn`,
      visibility: ["all_authenticated"],
      deletedAt: new Date(),
    });
    createdIds.push(shared, pathways, lead, scheduled, expired, withdrawn);

    const rows = await withRls(
      {
        userId: randomUUID(),
        programRole: "pathways",
        adminRole: "none",
        status: "active",
      },
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM announcements WHERE headline LIKE ${`${MARKER}-%`}
        `,
    );
    const ids = rows.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([shared, pathways]));
    expect(ids).not.toContain(lead);
    expect(ids).not.toContain(scheduled);
    expect(ids).not.toContain(expired);
    expect(ids).not.toContain(withdrawn);
  });

  it("pending and empty tokens select no live announcement", async () => {
    const id = await insertAnnouncement({
      headline: `${MARKER}-pending`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(id);
    const pending = await withRls(
      {
        userId: randomUUID(),
        programRole: "pathways",
        adminRole: "none",
        status: "pending",
      },
      (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM announcements WHERE id = ${id}::uuid`,
    );
    expect(pending).toEqual([]);
  });

  it("after own dismissal, pathways cannot SELECT that announcement", async () => {
    const userId = randomUUID();
    const id = await insertAnnouncement({
      headline: `${MARKER}-dismiss`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(id);
    await withRls(
      { userId, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO announcement_dismissals (user_id, announcement_id, dismissed_at)
          VALUES (${userId}::uuid, ${id}::uuid, CURRENT_TIMESTAMP)
        `,
    );
    const rows = await withRls(
      { userId, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM announcements WHERE id = ${id}::uuid`,
    );
    expect(rows).toEqual([]);
  });

  it("pathways cannot INSERT announcements; admin can", async () => {
    const memberId = randomUUID();
    await expect(
      withRls(
        {
          userId: randomUUID(),
          programRole: "pathways",
          adminRole: "none",
          status: "active",
        },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO announcements (
              id, headline, body, activates_at, expires_at, visibility, dismissible,
              created_by, created_at, updated_at
            ) VALUES (
              ${memberId}::uuid, ${`${MARKER}-member`}, 'b',
              CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP + interval '1 hour',
              '{all_authenticated}', true, ${randomUUID()}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);

    const adminId = randomUUID();
    createdIds.push(adminId);
    await withRls(
      {
        userId: randomUUID(),
        programRole: "none",
        adminRole: "admin",
        status: "active",
      },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO announcements (
            id, headline, body, activates_at, expires_at, visibility, dismissible,
            created_by, created_at, updated_at
          ) VALUES (
            ${adminId}::uuid, ${`${MARKER}-admin`}, 'b',
            CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP + interval '1 hour',
            '{all_authenticated}', true, ${randomUUID()}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
    );
  });

  it("pathways can INSERT own dismissal on a dismissible live row, not a lead-only or non-dismissible row", async () => {
    const userId = randomUUID();
    const ok = await insertAnnouncement({
      headline: `${MARKER}-ok-dismiss`,
      visibility: ["all_authenticated"],
    });
    const leadOnly = await insertAnnouncement({
      headline: `${MARKER}-lead-dismiss`,
      visibility: ["lead"],
    });
    const locked = await insertAnnouncement({
      headline: `${MARKER}-locked`,
      visibility: ["all_authenticated"],
      dismissible: false,
    });
    createdIds.push(ok, leadOnly, locked);

    await withRls(
      { userId, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO announcement_dismissals (user_id, announcement_id, dismissed_at)
          VALUES (${userId}::uuid, ${ok}::uuid, CURRENT_TIMESTAMP)
        `,
    );

    await expect(
      withRls(
        { userId, programRole: "pathways", adminRole: "none", status: "active" },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO announcement_dismissals (user_id, announcement_id, dismissed_at)
            VALUES (${userId}::uuid, ${leadOnly}::uuid, CURRENT_TIMESTAMP)
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);

    await expect(
      withRls(
        { userId, programRole: "pathways", adminRole: "none", status: "active" },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO announcement_dismissals (user_id, announcement_id, dismissed_at)
            VALUES (${userId}::uuid, ${locked}::uuid, CURRENT_TIMESTAMP)
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("moderator cannot INSERT or UPDATE announcements; admin can UPDATE", async () => {
    const id = await insertAnnouncement({
      headline: `${MARKER}-mod-upd`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(id);
    const memberId = randomUUID();
    await expect(
      withRls(
        {
          userId: randomUUID(),
          programRole: "none",
          adminRole: "moderator",
          status: "active",
        },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO announcements (
              id, headline, body, activates_at, expires_at, visibility, dismissible,
              created_by, created_at, updated_at
            ) VALUES (
              ${memberId}::uuid, ${`${MARKER}-mod-ins`}, 'b',
              CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP + interval '1 hour',
              '{all_authenticated}', true, ${randomUUID()}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);

    const moderatorUpdated = await withRls(
      {
        userId: randomUUID(),
        programRole: "none",
        adminRole: "moderator",
        status: "active",
      },
      (tx) =>
        tx.$executeRaw`
          UPDATE announcements SET headline = ${`${MARKER}-hack`} WHERE id = ${id}::uuid
        `,
    );
    expect(Number(moderatorUpdated)).toBe(0);

    const adminUpdated = await withRls(
      {
        userId: randomUUID(),
        programRole: "none",
        adminRole: "admin",
        status: "active",
      },
      (tx) =>
        tx.$executeRaw`
          UPDATE announcements SET headline = ${`${MARKER}-admin-upd`} WHERE id = ${id}::uuid
        `,
    );
    expect(Number(adminUpdated)).toBe(1);
  });

  it("pathways can INSERT own impression for a visible live banner, not after dismiss", async () => {
    const userId = randomUUID();
    const id = await insertAnnouncement({
      headline: `${MARKER}-impress`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(id);
    await withRls(
      { userId, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO announcement_impressions (user_id, announcement_id, created_at)
          VALUES (${userId}::uuid, ${id}::uuid, CURRENT_TIMESTAMP)
        `,
    );
    await withRls(
      { userId, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO announcement_dismissals (user_id, announcement_id, dismissed_at)
          VALUES (${userId}::uuid, ${id}::uuid, CURRENT_TIMESTAMP)
        `,
    );
    await expect(
      withRls(
        { userId, programRole: "pathways", adminRole: "none", status: "active" },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO announcement_cta_clicks (user_id, announcement_id, slot, created_at)
            VALUES (${userId}::uuid, ${id}::uuid, 'primary', CURRENT_TIMESTAMP)
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("announcement_dismissible is false for LEAD-only, withdrawn, and empty tokens (direct EXECUTE)", async () => {
    const leadOnly = await insertAnnouncement({
      headline: `${MARKER}-fn-lead`,
      visibility: ["lead"],
    });
    const withdrawn = await insertAnnouncement({
      headline: `${MARKER}-fn-withdrawn`,
      visibility: ["all_authenticated"],
      deletedAt: new Date(),
    });
    const visible = await insertAnnouncement({
      headline: `${MARKER}-fn-ok`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(leadOnly, withdrawn, visible);

    const pathwaysCtx = {
      userId: randomUUID(),
      programRole: "pathways" as const,
      adminRole: "none" as const,
      status: "active" as const,
    };
    const leadUnderPathways = await withRls(pathwaysCtx, (tx) =>
      tx.$queryRaw<{ ok: boolean }[]>`
        SELECT announcement_dismissible(${leadOnly}::uuid) AS ok
      `,
    );
    expect(leadUnderPathways[0]?.ok).toBe(false);

    const withdrawnUnderPathways = await withRls(pathwaysCtx, (tx) =>
      tx.$queryRaw<{ ok: boolean }[]>`
        SELECT announcement_dismissible(${withdrawn}::uuid) AS ok
      `,
    );
    expect(withdrawnUnderPathways[0]?.ok).toBe(false);

    const emptyTokens = await withRls(
      { userId: randomUUID(), programRole: "pathways", adminRole: "none", status: "pending" },
      (tx) =>
        tx.$queryRaw<{ ok: boolean }[]>`
          SELECT announcement_dismissible(${visible}::uuid) AS ok
        `,
    );
    expect(emptyTokens[0]?.ok).toBe(false);

    const visibleUnderPathways = await withRls(pathwaysCtx, (tx) =>
      tx.$queryRaw<{ ok: boolean }[]>`
        SELECT announcement_dismissible(${visible}::uuid) AS ok
      `,
    );
    expect(visibleUnderPathways[0]?.ok).toBe(true);
  });
});
