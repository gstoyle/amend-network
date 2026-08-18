import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { env } from "@/lib/env";
import { migrator } from "@/lib/db/migrator";
import { prisma } from "@/lib/db/prisma";
import { withRls, type RlsContext } from "@/lib/db/rls";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `snap-rls-${randomUUID()}`;
const HUNDRED_DAYS_MS = 100 * 24 * 60 * 60 * 1000;
const EIGHTY_FIVE_DAYS_MS = 85 * 24 * 60 * 60 * 1000;

type LeaderboardResource = { id: string; title: string; downloadCount: number };
type LeaderboardEvent = { id: string; title: string; yesCount: number };

type Snapshot = {
  kpis?: Record<string, number>;
  funnel?: Record<string, number>;
  topResources?: LeaderboardResource[];
  topEvents?: LeaderboardEvent[];
};

function parseSnapshot(raw: unknown): Snapshot {
  if (raw == null) {
    return {};
  }
  if (typeof raw === "string") {
    return JSON.parse(raw) as Snapshot;
  }
  if (typeof raw === "object") {
    return raw as Snapshot;
  }
  return {};
}

async function bindGucs(tx: Prisma.TransactionClient, ctx: RlsContext): Promise<void> {
  const userId = ctx.userId && ctx.userId.length > 0 ? ctx.userId : "00000000-0000-0000-0000-000000000000";
  await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.program_role', ${ctx.programRole ?? ""}, true)`;
  await tx.$executeRaw`SELECT set_config('app.admin_role', ${ctx.adminRole ?? ""}, true)`;
  await tx.$executeRaw`SELECT set_config('app.status', ${ctx.status ?? ""}, true)`;
  await tx.$executeRaw`SELECT set_config('app.auth_mode', ${ctx.authMode ?? ""}, true)`;
}

async function executeSnapshot(
  ctx: RlsContext,
  networkId: string | null = null,
): Promise<Snapshot> {
  const rows = await withRls(ctx, async (tx) =>
    tx.$queryRaw<{ snapshot: unknown }[]>`
      SELECT admin_analytics_snapshot(${networkId}::uuid) AS snapshot
    `,
  );
  return parseSnapshot(rows[0]?.snapshot);
}

/** Two EXECUTEs in one Repeatable Read txn so concurrent RLS fixtures cannot change counts between roles. */
async function executeSnapshotsSameIsolation(
  first: RlsContext,
  second: RlsContext,
  networkId: string | null = null,
): Promise<[Snapshot, Snapshot]> {
  return prisma.$transaction(
    async (tx) => {
      await bindGucs(tx, first);
      const firstRows = await tx.$queryRaw<{ snapshot: unknown }[]>`
        SELECT admin_analytics_snapshot(${networkId}::uuid) AS snapshot
      `;
      await bindGucs(tx, second);
      const secondRows = await tx.$queryRaw<{ snapshot: unknown }[]>`
        SELECT admin_analytics_snapshot(${networkId}::uuid) AS snapshot
      `;
      return [parseSnapshot(firstRows[0]?.snapshot), parseSnapshot(secondRows[0]?.snapshot)];
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

function gucFor(
  role: "super_admin" | "admin" | "moderator" | "pathways" | "lead" | "pending",
) {
  const claims = claimsFor(role)!;
  return {
    userId: claims.userId,
    programRole: claims.programRole,
    adminRole: claims.adminRole,
    status: claims.status,
  };
}

async function pathwaysNetworkId(): Promise<string> {
  const rows = await migrator.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM networks WHERE name = 'Pathways to Change' LIMIT 1
  `;
  const id = rows[0]?.id;
  if (!id) {
    throw new Error("Pathways to Change network missing");
  }
  return id;
}

async function insertMember(input: {
  id: string;
  email: string;
  programRole: "pathways" | "lead";
  status: "pending" | "active" | "deactivated" | "denied";
  joinSource: "invited" | "self_registered";
  createdAt: Date;
}): Promise<void> {
  const networkId = await pathwaysNetworkId();
  const passwordHash = await hashPassword(env().SEED_PASSWORD);
  await migrator.$executeRaw`
    INSERT INTO users (
      id, email_lookup, email_encrypted, password_hash,
      first_name_encrypted, last_name_encrypted,
      program_role, admin_role, status, join_source, network_id, created_at, updated_at
    ) VALUES (
      ${input.id}::uuid,
      ${Buffer.from(hmacEmailLookup(input.email))},
      ${Buffer.from(encryptPii(input.email))},
      ${passwordHash},
      ${Buffer.from(encryptPii("Snap"))},
      ${Buffer.from(encryptPii("Member"))},
      ${input.programRole}::"ProgramRole",
      'none'::"AdminRole",
      ${input.status}::"UserStatus",
      ${input.joinSource}::"JoinSource",
      ${networkId}::uuid,
      ${input.createdAt},
      CURRENT_TIMESTAMP
    )
  `;
}

async function insertResource(title: string, downloadCount: number): Promise<string> {
  const id = randomUUID();
  await migrator.$executeRaw`
    INSERT INTO resources (
      id, title, preview_text, thumbnail_object_key, source_label, tags,
      file_object_key, file_size_bytes, file_mime_type, visibility,
      download_count, uploaded_by, created_at, updated_at
    ) VALUES (
      ${id}::uuid,
      ${title},
      ${"Preview " + title},
      ${"seed/thumb.png"},
      ${"Amend"},
      ARRAY[]::text[],
      ${"seed/file.pdf"},
      ${1024}::bigint,
      ${"application/pdf"},
      ${"{all_authenticated}"}::text[],
      ${downloadCount},
      ${randomUUID()}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return id;
}

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
      ${"Body " + title},
      ${startsAt},
      ${endsAt},
      false,
      ${"{all_authenticated}"}::text[],
      ${randomUUID()}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return id;
}

async function insertYesRsvps(eventId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const userId = randomUUID();
    await migrator.$executeRaw`
      INSERT INTO event_rsvps (
        user_id, event_id, status, created_at, updated_at
      ) VALUES (
        ${userId}::uuid,
        ${eventId}::uuid,
        'yes',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

describe("admin_analytics_snapshot direct EXECUTE as amend_app — contracts/rls-policies.md", () => {
  const createdUserIds: string[] = [];
  const createdResourceIds: string[] = [];
  const createdEventIds: string[] = [];

  afterEach(async () => {
    if (createdEventIds.length > 0) {
      await migrator.$executeRaw`
        DELETE FROM event_rsvps WHERE event_id = ANY(${createdEventIds}::uuid[])
      `;
      await migrator.$executeRaw`
        DELETE FROM events WHERE id = ANY(${createdEventIds}::uuid[])
      `;
      createdEventIds.length = 0;
    }
    if (createdResourceIds.length > 0) {
      await migrator.$executeRaw`
        DELETE FROM resources WHERE id = ANY(${createdResourceIds}::uuid[])
      `;
      createdResourceIds.length = 0;
    }
    await migrator.auditLog.deleteMany({ where: { userAgent: MARKER } });
    if (createdUserIds.length > 0) {
      await migrator.$executeRaw`DELETE FROM users WHERE id = ANY(${createdUserIds}::uuid[])`;
      createdUserIds.length = 0;
    }
  });

  it("Admin and Super Admin EXECUTE return identical kpis/funnel/leaderboard JSON", async () => {
    const retainedId = randomUUID();
    createdUserIds.push(retainedId);
    const createdAt = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    await insertMember({
      id: retainedId,
      email: `${MARKER}-retained@example.com`,
      programRole: "pathways",
      status: "active",
      joinSource: "invited",
      createdAt,
    });
    await migrator.auditLog.create({
      data: {
        actorUserId: retainedId,
        actorRole: "pathways",
        action: "login_success",
        ip: "127.0.0.1",
        userAgent: MARKER,
        severity: "info",
        createdAt: new Date(Date.now() - HUNDRED_DAYS_MS),
      },
    });
    await migrator.auditLog.create({
      data: {
        actorUserId: retainedId,
        actorRole: "pathways",
        action: "login_success",
        ip: "127.0.0.1",
        userAgent: MARKER,
        severity: "info",
        createdAt: new Date(Date.now() - EIGHTY_FIVE_DAYS_MS),
      },
    });

    const [superSnap, adminSnap] = await executeSnapshotsSameIsolation(
      gucFor("super_admin"),
      gucFor("admin"),
    );
    expect(superSnap.kpis).toEqual(expect.any(Object));
    expect(superSnap.funnel).toEqual(expect.any(Object));
    expect(adminSnap.kpis).toEqual(superSnap.kpis);
    expect(adminSnap.funnel).toEqual(superSnap.funnel);
    expect(adminSnap.topResources).toEqual(superSnap.topResources);
    expect(adminSnap.topEvents).toEqual(superSnap.topEvents);
  });

  it("Moderator, Pathways, LEAD, and pending EXECUTE return {} with no kpis", async () => {
    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      const snap = await executeSnapshot(gucFor(role));
      expect(snap.kpis, role).toBeUndefined();
      expect(snap).toEqual({});
    }
  });

  it("Admin SELECT on audit_log still hides rows older than 90 days that the snapshot used for retention", async () => {
    const retainedId = randomUUID();
    createdUserIds.push(retainedId);
    await insertMember({
      id: retainedId,
      email: `${MARKER}-oldlogin@example.com`,
      programRole: "pathways",
      status: "active",
      joinSource: "invited",
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    });
    const oldLogin = await migrator.auditLog.create({
      data: {
        actorUserId: retainedId,
        actorRole: "pathways",
        action: "login_success",
        ip: "127.0.0.1",
        userAgent: MARKER,
        severity: "info",
        createdAt: new Date(Date.now() - HUNDRED_DAYS_MS),
      },
    });
    await migrator.auditLog.create({
      data: {
        actorUserId: retainedId,
        actorRole: "pathways",
        action: "login_success",
        ip: "127.0.0.1",
        userAgent: MARKER,
        severity: "info",
        createdAt: new Date(Date.now() - EIGHTY_FIVE_DAYS_MS),
      },
    });

    const admin = gucFor("admin");
    const visible = await withRls(admin, (tx) =>
      tx.auditLog.findMany({ where: { userAgent: MARKER } }),
    );
    expect(visible.map((row) => row.id.toString())).not.toContain(oldLogin.id.toString());

    const snap = await executeSnapshot(admin);
    expect(snap.funnel?.firstLogin).toBeGreaterThanOrEqual(1);
    expect(snap.funnel?.retained).toBeGreaterThanOrEqual(1);
  });

  it("k=3 omission: resource downloadCount 2 and event yesCount 2 are absent (not listed, not zeroed)", async () => {
    const lowResourceId = await insertResource(`${MARKER}-downloads-2`, 2);
    createdResourceIds.push(lowResourceId);
    const lowEventId = await insertEvent(`${MARKER}-yes-2`);
    createdEventIds.push(lowEventId);
    await insertYesRsvps(lowEventId, 2);

    const snap = await executeSnapshot(gucFor("super_admin"));
    const resourceIds = (snap.topResources ?? []).map((row) => row.id);
    const resourceTitles = (snap.topResources ?? []).map((row) => row.title);
    const eventIds = (snap.topEvents ?? []).map((row) => row.id);
    const eventTitles = (snap.topEvents ?? []).map((row) => row.title);

    expect(resourceIds).not.toContain(lowResourceId);
    expect(resourceTitles).not.toContain(`${MARKER}-downloads-2`);
    expect(snap.topResources?.some((row) => row.id === lowResourceId && row.downloadCount === 0)).toBe(
      false,
    );
    expect(eventIds).not.toContain(lowEventId);
    expect(eventTitles).not.toContain(`${MARKER}-yes-2`);
    expect(snap.topEvents?.some((row) => row.id === lowEventId && row.yesCount === 0)).toBe(false);
  });

  it("k=3 inclusion: resource downloadCount 3 and event yesCount 3 appear with those counts", async () => {
    const okResourceId = await insertResource(`${MARKER}-downloads-3`, 3);
    createdResourceIds.push(okResourceId);
    const okEventId = await insertEvent(`${MARKER}-yes-3`);
    createdEventIds.push(okEventId);
    await insertYesRsvps(okEventId, 3);

    const snap = await executeSnapshot(gucFor("super_admin"));
    const resource = (snap.topResources ?? []).find((row) => row.id === okResourceId);
    const event = (snap.topEvents ?? []).find((row) => row.id === okEventId);

    expect(resource).toEqual({
      id: okResourceId,
      title: `${MARKER}-downloads-3`,
      downloadCount: 3,
    });
    expect(event).toEqual({
      id: okEventId,
      title: `${MARKER}-yes-3`,
      yesCount: 3,
    });
  });

  it("topEvents length is at most 10 after k=3 filter", async () => {
    for (let i = 0; i < 11; i += 1) {
      const eventId = await insertEvent(`${MARKER}-cap-${String(i).padStart(2, "0")}`);
      createdEventIds.push(eventId);
      await insertYesRsvps(eventId, 3);
    }
    const snap = await executeSnapshot(gucFor("super_admin"));
    expect(snap.topEvents?.length ?? 0).toBeLessThanOrEqual(10);
    const markerEvents = (snap.topEvents ?? []).filter((row) =>
      row.title.startsWith(`${MARKER}-cap-`),
    );
    expect(markerEvents.length).toBeLessThanOrEqual(10);
  });
});
