import type { AdminRole, ProgramRole, SessionClaims, UserStatus } from "@/lib/auth/types";

export const MATRIX_ROLES = [
  "super_admin",
  "admin",
  "moderator",
  "pathways",
  "lead",
  "pending",
  "invited",
] as const;

export type MatrixRole = (typeof MATRIX_ROLES)[number];

export const CAPABILITIES = [
  "log_in",
  "view_dashboard",
  "view_shared_resources",
  "view_role_specific_resources",
  "download_resources",
  "upload_edit_delete_resources",
  "view_events",
  "rsvp_events",
  "create_edit_delete_events",
  "view_directory",
  "appear_in_directory",
  "view_forum",
  "post_forum",
  "moderate_forum",
  "view_announcements",
  "create_manage_announcements",
  "approve_deny_registrations",
  "assign_change_roles",
  "view_analytics",
  "view_audit_log",
  "change_system_configuration",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type MatrixVerdict = "allow" | "deny" | "fail-closed";

const D = "deny" as const;
const A = "allow" as const;
const FC = "fail-closed" as const;

/** PRD §3 as contracted in specs/002-auth-rbac/contracts/permission-matrix.md */
export const PRD_MATRIX: Record<Capability, Record<MatrixRole, MatrixVerdict>> = {
  log_in: {
    super_admin: A,
    admin: A,
    moderator: A,
    pathways: A,
    lead: A,
    pending: A,
    invited: D,
  },
  view_dashboard: {
    super_admin: A,
    admin: A,
    moderator: A,
    pathways: A,
    lead: A,
    pending: D,
    invited: D,
  },
  view_shared_resources: {
    super_admin: A,
    admin: A,
    moderator: A,
    pathways: A,
    lead: A,
    pending: D,
    invited: D,
  },
  view_role_specific_resources: {
    super_admin: A,
    admin: A,
    moderator: A,
    pathways: A,
    lead: A,
    pending: D,
    invited: D,
  },
  download_resources: {
    super_admin: A,
    admin: A,
    moderator: A,
    pathways: A,
    lead: A,
    pending: D,
    invited: D,
  },
  upload_edit_delete_resources: {
    super_admin: A,
    admin: A,
    moderator: D,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
  view_events: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: FC,
    lead: FC,
    pending: D,
    invited: D,
  },
  rsvp_events: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: FC,
    lead: FC,
    pending: D,
    invited: D,
  },
  create_edit_delete_events: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
  view_directory: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: FC,
    lead: FC,
    pending: D,
    invited: D,
  },
  appear_in_directory: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: FC,
    lead: FC,
    pending: D,
    invited: D,
  },
  view_forum: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: FC,
    lead: FC,
    pending: D,
    invited: D,
  },
  post_forum: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: FC,
    lead: FC,
    pending: D,
    invited: D,
  },
  moderate_forum: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
  view_announcements: {
    super_admin: FC,
    admin: FC,
    moderator: FC,
    pathways: FC,
    lead: FC,
    pending: D,
    invited: D,
  },
  create_manage_announcements: {
    super_admin: FC,
    admin: FC,
    moderator: D,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
  approve_deny_registrations: {
    super_admin: A,
    admin: A,
    moderator: D,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
  assign_change_roles: {
    super_admin: FC,
    admin: FC,
    moderator: D,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
  view_analytics: {
    super_admin: FC,
    admin: FC,
    moderator: D,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
  view_audit_log: {
    super_admin: A,
    admin: A,
    moderator: D,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
  change_system_configuration: {
    super_admin: FC,
    admin: D,
    moderator: D,
    pathways: D,
    lead: D,
    pending: D,
    invited: D,
  },
};

export const EXPECTED_VISIBLE_TITLES: Record<MatrixRole, string[]> = {
  super_admin: ["All authenticated"],
  admin: ["All authenticated"],
  moderator: ["Pathways only", "LEAD only", "All authenticated", "Both programs"],
  pathways: ["Pathways only", "All authenticated", "Both programs"],
  lead: ["LEAD only", "All authenticated", "Both programs"],
  pending: [],
  invited: [],
};

export function claimsFor(role: MatrixRole): SessionClaims | null {
  if (role === "invited") {
    return null;
  }
  const programRole: ProgramRole =
    role === "pathways" ? "pathways" : role === "lead" ? "lead" : "none";
  const adminRole: AdminRole =
    role === "super_admin"
      ? "super_admin"
      : role === "admin"
        ? "admin"
        : role === "moderator"
          ? "moderator"
          : "none";
  const status: UserStatus = role === "pending" ? "pending" : "active";
  return {
    sessionId: `matrix-${role}`,
    userId: "00000000-0000-4000-8000-000000000001",
    programRole,
    adminRole,
    status,
    mfaEnabled: false,
    mfaSatisfied: role === "super_admin" || role === "moderator",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}
