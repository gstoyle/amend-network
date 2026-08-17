import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import {
  CAPABILITIES,
  EXPECTED_VISIBLE_TITLES,
  MATRIX_ROLES,
  PRD_MATRIX,
  claimsFor,
  type Capability,
  type MatrixRole,
  type MatrixVerdict,
} from "@/tests/helpers/prd-matrix";

function isBuilt(capability: Capability): boolean {
  switch (capability) {
    case "log_in":
    case "view_dashboard":
    case "view_audit_log":
    case "approve_deny_registrations":
      return true;
    case "view_shared_resources":
    case "view_role_specific_resources":
    case "download_resources":
    case "upload_edit_delete_resources":
    case "view_events":
    case "rsvp_events":
    case "create_edit_delete_events":
    case "view_directory":
    case "appear_in_directory":
    case "view_forum":
    case "post_forum":
    case "moderate_forum":
    case "view_announcements":
    case "create_manage_announcements":
    case "assign_change_roles":
    case "view_analytics":
    case "change_system_configuration":
      return false;
    default: {
      const _exhaustive: never = capability;
      return _exhaustive;
    }
  }
}

async function rlsVisibleTitles(role: MatrixRole): Promise<string[]> {
  const session = claimsFor(role);
  if (!session) {
    return withRls({}, async (tx) => {
      const rows = await tx.visibilityRecord.findMany();
      return rows.map((row) => row.title);
    });
  }
  return withRls(
    {
      userId: session.userId,
      programRole: session.programRole,
      adminRole: session.adminRole,
      status: session.status,
    },
    async (tx) => {
      const rows = await tx.visibilityRecord.findMany();
      return rows.map((row) => row.title);
    },
  );
}

async function rlsCanReadAudit(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  if (!session) {
    const rows = await withRls({}, (tx) => tx.auditLog.findMany({ take: 1 }));
    return rows.length > 0;
  }
  const rows = await withRls(
    {
      userId: session.userId,
      programRole: session.programRole,
      adminRole: session.adminRole,
      status: session.status,
    },
    (tx) => tx.auditLog.findMany({ take: 5 }),
  );
  return rows.length > 0;
}

async function rlsCanSeePending(role: MatrixRole): Promise<boolean> {
  const pending = await migrator.user.findFirst({ where: { status: "pending" } });
  if (!pending) {
    return false;
  }
  const session = claimsFor(role);
  const rows = await withRls(
    session
      ? {
          userId: session.userId,
          programRole: session.programRole,
          adminRole: session.adminRole,
          status: session.status,
        }
      : {},
    (tx) => tx.user.findMany({ where: { id: pending.id } }),
  );
  return rows.length > 0;
}

function rlsVerdict(
  role: MatrixRole,
  capability: Capability,
  auditVisible: boolean,
  pendingVisible: boolean,
): MatrixVerdict {
  switch (capability) {
    case "log_in":
      return role === "invited" ? "deny" : "allow";
    case "view_dashboard":
      return role === "invited" || role === "pending" ? "deny" : "allow";
    case "view_audit_log":
      return auditVisible ? "allow" : "deny";
    case "approve_deny_registrations":
      return pendingVisible ? "allow" : "deny";
    case "view_shared_resources":
    case "view_role_specific_resources":
    case "download_resources":
    case "upload_edit_delete_resources":
    case "view_events":
    case "rsvp_events":
    case "create_edit_delete_events":
    case "view_directory":
    case "appear_in_directory":
    case "view_forum":
    case "post_forum":
    case "moderate_forum":
    case "view_announcements":
    case "create_manage_announcements":
    case "assign_change_roles":
    case "view_analytics":
    case "change_system_configuration":
      return isBuilt(capability) ? "allow" : "fail-closed";
    default: {
      const _exhaustive: never = capability;
      return _exhaustive;
    }
  }
}

const MARKER = `rls-matrix-${randomUUID()}`;

describe("RLS permission matrix (GUCs only, no requireRole)", () => {
  it.each(MATRIX_ROLES)("%s fixture visibility via GUCs matches the contract", async (role) => {
    const titles = await rlsVisibleTitles(role);
    expect([...titles].sort()).toEqual([...EXPECTED_VISIBLE_TITLES[role]].sort());
  });

  it.each(MATRIX_ROLES.flatMap((role) => CAPABILITIES.map((capability) => [role, capability] as const)))(
    "%s / %s",
    async (role, capability) => {
      if (capability === "view_audit_log") {
        await migrator.auditLog.create({
          data: {
            actorRole: "none",
            action: "login_success",
            ip: "127.0.0.1",
            userAgent: MARKER,
            severity: "info",
          },
        });
      }
      const auditVisible = capability === "view_audit_log" ? await rlsCanReadAudit(role) : false;
      const pendingVisible =
        capability === "approve_deny_registrations" ? await rlsCanSeePending(role) : false;
      const expected = PRD_MATRIX[capability][role];
      if (!isBuilt(capability)) {
        expect(["deny", "fail-closed"]).toContain(expected);
        expect(expected).not.toBe("allow");
        return;
      }
      const actual = rlsVerdict(role, capability, auditVisible, pendingVisible);
      expect(actual).toBe(expected);
    },
  );

  it("admin audit SELECT is limited to 90 days; super_admin is not", async () => {
    const old = await migrator.auditLog.create({
      data: {
        actorRole: "none",
        action: "login_success",
        ip: "127.0.0.1",
        userAgent: MARKER,
        severity: "info",
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
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

    const superAdmin = claimsFor("super_admin")!;
    const admin = claimsFor("admin")!;

    const superRows = await withRls(
      {
        userId: superAdmin.userId,
        programRole: superAdmin.programRole,
        adminRole: superAdmin.adminRole,
        status: superAdmin.status,
      },
      (tx) => tx.auditLog.findMany({ where: { userAgent: MARKER, id: { in: [old.id, recent.id] } } }),
    );
    const adminRows = await withRls(
      {
        userId: admin.userId,
        programRole: admin.programRole,
        adminRole: admin.adminRole,
        status: admin.status,
      },
      (tx) => tx.auditLog.findMany({ where: { userAgent: MARKER, id: { in: [old.id, recent.id] } } }),
    );

    expect(superRows.map((row) => row.id.toString())).toEqual(
      expect.arrayContaining([old.id.toString(), recent.id.toString()]),
    );
    expect(adminRows.map((row) => row.id.toString())).toContain(recent.id.toString());
    expect(adminRows.map((row) => row.id.toString())).not.toContain(old.id.toString());
  });
});
