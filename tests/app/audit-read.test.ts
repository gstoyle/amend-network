import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { listAuditLog } from "@/lib/audit/read";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import { migrator } from "@/lib/db/migrator";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `vitest-audit-read-${randomUUID()}`;
const HUNDRED_DAYS_MS = 100 * 24 * 60 * 60 * 1000;
const NINETY_ONE_DAYS_MS = 91 * 24 * 60 * 60 * 1000;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
const TWENTY_DAYS_MS = 20 * 24 * 60 * 60 * 1000;
const TWO_HUNDRED_DAYS_MS = 200 * 24 * 60 * 60 * 1000;
const FILTER_ERROR = "Check the form and try again.";
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function mfaAdmin() {
  return { ...claimsFor("admin")!, mfaEnabled: true, mfaSatisfied: true };
}

async function countViewed(): Promise<number> {
  return migrator.auditLog.count({
    where: { action: "audit_log_viewed", userAgent: MARKER },
  });
}

async function seedWindowRows() {
  const old = await migrator.auditLog.create({
    data: {
      actorRole: "none",
      action: "login_success",
      ip: "127.0.0.1",
      userAgent: MARKER,
      severity: "info",
      createdAt: new Date(Date.now() - HUNDRED_DAYS_MS),
    },
  });
  const recent = await migrator.auditLog.create({
    data: {
      actorRole: "none",
      action: "logout",
      ip: "127.0.0.1",
      userAgent: MARKER,
      severity: "info",
    },
  });
  return { old, recent };
}

describe("audit log read (app layer, FR-020)", () => {
  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: MARKER } });
  });

  it("denies Pathways, LEAD, and Moderator even with a client admin claim", async () => {
    await seedWindowRows();
    for (const role of ["pathways", "lead", "moderator"] as const) {
      await expect(
        listAuditLog(claimsFor(role), {
          clientAdminRole: "super_admin",
          clientMfaSatisfied: true,
        }),
      ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    }
  });

  it("does not mock requireRole: admin without mfa_satisfied is denied", () => {
    const admin = claimsFor("admin");
    expect(admin?.mfaSatisfied).toBe(false);
    expect(() =>
      requireRole(admin, { admin: ["super_admin", "admin"], mfa: true }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("Independent Test: Super Admin full history; Admin last 90 days", async () => {
    const { old, recent } = await seedWindowRows();

    const superAdmin = claimsFor("super_admin")!;
    const superRows = await listAuditLog(superAdmin, {
      take: 10_000,
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    const superIds = superRows.rows.map((row) => row.id);
    expect(superIds).toContain(old.id.toString());
    expect(superIds).toContain(recent.id.toString());

    const adminRows = await listAuditLog(mfaAdmin(), {
      take: 10_000,
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    const adminIds = adminRows.rows.map((row) => row.id);
    expect(adminIds).toContain(recent.id.toString());
    expect(adminIds).not.toContain(old.id.toString());
  });

  it("writes audit_log_viewed in the same read transaction (PRD §6)", async () => {
    await seedWindowRows();
    await listAuditLog(claimsFor("super_admin")!, {
      take: 10,
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    const viewed = await migrator.auditLog.findFirst({
      where: { action: "audit_log_viewed", userAgent: MARKER },
    });
    expect(viewed).not.toBeNull();
    expect(viewed?.severity).toBe("info");
    expect(viewed?.actorUserId).toBe(claimsFor("super_admin")!.userId);
  });

  it("Independent Test: combined AND filters; Admin 90-day clip holds when from is older; viewer columns; one viewed row", async () => {
    const actorA = randomUUID();
    const actorB = randomUUID();
    const target = randomUUID();
    const old = await migrator.auditLog.create({
      data: {
        actorUserId: actorA,
        actorRole: "none",
        action: "login_success",
        entityType: "user",
        entityId: "old-entity",
        targetUserId: target,
        ip: "10.0.0.1",
        userAgent: MARKER,
        severity: "info",
        createdAt: new Date(Date.now() - NINETY_ONE_DAYS_MS),
      },
    });
    const warningMatch = await migrator.auditLog.create({
      data: {
        actorUserId: actorA,
        actorRole: "admin",
        action: "login_success",
        entityType: "user",
        entityId: "warn-entity",
        targetUserId: target,
        ip: "10.0.0.2",
        userAgent: MARKER,
        severity: "warning",
        createdAt: new Date(Date.now() - TEN_DAYS_MS),
      },
    });
    const logoutRecent = await migrator.auditLog.create({
      data: {
        actorUserId: actorA,
        actorRole: "none",
        action: "logout",
        ip: "10.0.0.3",
        userAgent: MARKER,
        severity: "info",
      },
    });
    const otherActor = await migrator.auditLog.create({
      data: {
        actorUserId: actorB,
        actorRole: "none",
        action: "login_success",
        ip: "10.0.0.4",
        userAgent: MARKER,
        severity: "security",
      },
    });

    const fromOlderThanWindow = new Date(Date.now() - TWO_HUNDRED_DAYS_MS).toISOString();
    const superWide = await listAuditLog(claimsFor("super_admin")!, {
      from: fromOlderThanWindow,
      take: 10_000,
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    const superWideIds = superWide.rows.map((row) => row.id);
    expect(superWideIds).toContain(old.id.toString());
    expect(superWideIds).toContain(warningMatch.id.toString());

    const beforeAdminViewed = await countViewed();
    const adminWide = await listAuditLog(mfaAdmin(), {
      from: fromOlderThanWindow,
      take: 10_000,
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    const adminWideIds = adminWide.rows.map((row) => row.id);
    expect(adminWideIds).not.toContain(old.id.toString());
    expect(adminWideIds).toContain(warningMatch.id.toString());
    expect(adminWideIds).toContain(logoutRecent.id.toString());
    expect(await countViewed()).toBe(beforeAdminViewed + 1);

    const beforeAndViewed = await countViewed();
    const combined = await listAuditLog(claimsFor("super_admin")!, {
      actor: actorA,
      action: "login_success",
      from: new Date(Date.now() - TWENTY_DAYS_MS).toISOString(),
      to: new Date().toISOString(),
      severity: "warning",
      take: 10_000,
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    expect(combined.rows.map((row) => row.id)).toEqual([warningMatch.id.toString()]);
    expect(combined.rows.map((row) => row.id)).not.toContain(old.id.toString());
    expect(combined.rows.map((row) => row.id)).not.toContain(logoutRecent.id.toString());
    expect(combined.rows.map((row) => row.id)).not.toContain(otherActor.id.toString());
    expect(await countViewed()).toBe(beforeAndViewed + 1);

    const [row] = combined.rows;
    expect(row).toMatchObject({
      id: warningMatch.id.toString(),
      actorUserId: actorA,
      actorRole: "admin",
      action: "login_success",
      entityType: "user",
      entityId: "warn-entity",
      targetUserId: target,
      ip: "10.0.0.2",
      userAgent: MARKER,
      severity: "warning",
    });
    expect(row).not.toHaveProperty("metadata");
    expect(row.createdAt).toBe(warningMatch.createdAt.toISOString());

    const oldAfter = await migrator.auditLog.findUniqueOrThrow({ where: { id: old.id } });
    expect(oldAfter.action).toBe("login_success");
    expect(oldAfter.createdAt.toISOString()).toBe(old.createdAt.toISOString());
    expect(oldAfter.metadata).toEqual({});
  });

  it("invalid actor, action, date, or from>to rejects with no rows and no viewed write", async () => {
    await seedWindowRows();
    const before = await countViewed();
    await expect(
      listAuditLog(claimsFor("super_admin")!, {
        action: "not_an_action",
        ip: "127.0.0.1",
        userAgent: MARKER,
      }),
    ).rejects.toThrowError(FILTER_ERROR);
    await expect(
      listAuditLog(claimsFor("super_admin")!, {
        actor: "not-a-uuid",
        ip: "127.0.0.1",
        userAgent: MARKER,
      }),
    ).rejects.toThrowError(FILTER_ERROR);
    await expect(
      listAuditLog(claimsFor("super_admin")!, {
        from: "not-a-date",
        ip: "127.0.0.1",
        userAgent: MARKER,
      }),
    ).rejects.toThrowError(FILTER_ERROR);
    await expect(
      listAuditLog(claimsFor("super_admin")!, {
        from: new Date().toISOString(),
        to: new Date(Date.now() - TEN_DAYS_MS).toISOString(),
        ip: "127.0.0.1",
        userAgent: MARKER,
      }),
    ).rejects.toThrowError(FILTER_ERROR);
    expect(await countViewed()).toBe(before);
  });

  it("audit-log page wires presentational filters; table container-scrolls; form has no role logic", () => {
    const page = readFileSync(
      path.join(repoRoot, "app/(admin)/admin/audit-log/page.tsx"),
      "utf8",
    );
    const filters = readFileSync(path.join(repoRoot, "components/audit-log-filters.tsx"), "utf8");
    expect(page).toContain("AuditLogFilters");
    expect(page).toContain("searchParams");
    expect(page).toContain("overflow-x-auto");
    expect(filters).not.toMatch(/adminRole|super_admin|requireRole|mfaSatisfied/);
  });
});
