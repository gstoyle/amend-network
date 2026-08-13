export type ProgramRole = "pathways" | "lead" | "none";
export type AdminRole = "super_admin" | "admin" | "moderator" | "none";
export type UserStatus = "pending" | "active" | "deactivated" | "denied";

export type SessionClaims = {
  sessionId: string;
  userId: string;
  programRole: ProgramRole;
  adminRole: AdminRole;
  status: UserStatus;
  mfaEnabled: boolean;
  mfaSatisfied: boolean;
  expiresAt: string;
};
