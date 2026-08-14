import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `vitest-rls-audit-read-${randomUUID()}`;
const HUNDRED_DAYS_MS = 100 * 24 * 60 * 60 * 1000;

describe("audit_log RLS (GUCs only, no requireRole)", () => {
  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: MARKER } });
  });

  it("Independent Test: member sees none; admin 90d; super_admin full; UPDATE/DELETE fail", async () => {
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

    const pathways = claimsFor("pathways")!;
    const memberRows = await withRls(
      {
        userId: pathways.userId,
        programRole: pathways.programRole,
        adminRole: pathways.adminRole,
        status: pathways.status,
      },
      (tx) => tx.auditLog.findMany({ where: { userAgent: MARKER } }),
    );
    expect(memberRows).toHaveLength(0);

    const admin = claimsFor("admin")!;
    const adminRows = await withRls(
      {
        userId: admin.userId,
        programRole: admin.programRole,
        adminRole: admin.adminRole,
        status: admin.status,
      },
      (tx) => tx.auditLog.findMany({ where: { userAgent: MARKER } }),
    );
    expect(adminRows.map((row) => row.id.toString())).toContain(recent.id.toString());
    expect(adminRows.map((row) => row.id.toString())).not.toContain(old.id.toString());

    const superAdmin = claimsFor("super_admin")!;
    const superRows = await withRls(
      {
        userId: superAdmin.userId,
        programRole: superAdmin.programRole,
        adminRole: superAdmin.adminRole,
        status: superAdmin.status,
      },
      (tx) => tx.auditLog.findMany({ where: { userAgent: MARKER } }),
    );
    expect(superRows.map((row) => row.id.toString())).toEqual(
      expect.arrayContaining([old.id.toString(), recent.id.toString()]),
    );

    await expect(
      prisma.auditLog.update({
        where: { id: recent.id },
        data: { action: "logout" },
      }),
    ).rejects.toThrow();
    await expect(prisma.auditLog.delete({ where: { id: recent.id } })).rejects.toThrow();
  });
});
