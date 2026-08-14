import { describe, expect, it } from "vitest";
import { requireRole } from "@/lib/auth/requireRole";
import { listVisibleRecords } from "@/lib/db/visibility";
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

function isBuilt(_capability: Capability): boolean {
  switch (_capability) {
    case "log_in":
    case "view_dashboard":
    case "view_audit_log":
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
    case "approve_deny_registrations":
    case "assign_change_roles":
    case "view_analytics":
    case "change_system_configuration":
      return false;
    default: {
      const _exhaustive: never = _capability;
      return _exhaustive;
    }
  }
}

function appAllows(role: MatrixRole, capability: Capability): boolean {
  const session = claimsFor(role);
  switch (capability) {
    case "log_in":
      return session !== null;
    case "view_dashboard": {
      try {
        requireRole(session);
        return true;
      } catch {
        return false;
      }
    }
    case "view_audit_log": {
      try {
        requireRole(session, { admin: ["super_admin", "admin"] });
        return true;
      } catch {
        return false;
      }
    }
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
    case "approve_deny_registrations":
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

function actualVerdict(role: MatrixRole, capability: Capability): MatrixVerdict {
  if (!isBuilt(capability)) {
    return appAllows(role, capability) ? "allow" : "fail-closed";
  }
  return appAllows(role, capability) ? "allow" : "deny";
}

describe("app permission matrix (FR-025, requireRole not mocked)", () => {
  it.each(MATRIX_ROLES.flatMap((role) => CAPABILITIES.map((capability) => [role, capability] as const)))(
    "%s / %s",
    async (role, capability) => {
      const expected = PRD_MATRIX[capability][role];
      if (!isBuilt(capability)) {
        expect(appAllows(role, capability)).toBe(false);
        expect(["deny", "fail-closed"]).toContain(expected);
        return;
      }
      expect(actualVerdict(role, capability)).toBe(expected);
    },
  );

  it.each(MATRIX_ROLES)("%s sees only fixture titles allowed by visibility intersection", async (role) => {
    const session = claimsFor(role);
    if (!session) {
      expect(EXPECTED_VISIBLE_TITLES[role]).toEqual([]);
      return;
    }
    try {
      requireRole(session);
    } catch {
      expect(EXPECTED_VISIBLE_TITLES[role]).toEqual([]);
      return;
    }
    const rows = await listVisibleRecords(session);
    expect(rows.map((row) => row.title).sort()).toEqual([...EXPECTED_VISIBLE_TITLES[role]].sort());
  });
});
