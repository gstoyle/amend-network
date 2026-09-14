export type ProgramRole = "pathways" | "lead" | "none";
export type AdminRole = "super_admin" | "admin" | "moderator" | "none";
export type UserStatus = "pending" | "active" | "deactivated" | "denied";

export type SessionClaims = {
  sessionId: string;
  userId: string;
  programRole: ProgramRole;
  /** Extra programme tokens from `user_networks`. Omit in tests that only set `programRole`. */
  programRoles?: Array<"pathways" | "lead">;
  adminRole: AdminRole;
  status: UserStatus;
  mfaEnabled: boolean;
  mfaSatisfied: boolean;
  expiresAt: string;
};
