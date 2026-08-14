import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { listAuditLog } from "@/lib/audit/read";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import { migrator } from "@/lib/db/migrator";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `vitest-audit-read-${randomUUID()}`;
const HUNDRED_DAYS_MS = 100 * 24 * 60 * 60 * 1000;

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

    const admin = {
      ...claimsFor("admin")!,
      mfaEnabled: true,
      mfaSatisfied: true,
    };
    const adminRows = await listAuditLog(admin, {
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
});
