import type { AdminRole, SessionClaims } from "@/lib/auth/types";

export const ADMIN_ROLES: AdminRole[] = ["super_admin", "admin", "moderator"];

export type AdminMfaDestination = "/mfa/enroll" | "/mfa/challenge" | null;

/** Destination for an admin who has a session but has not satisfied MFA. Members get null. */
export function adminMfaDestination(claims: SessionClaims | null): AdminMfaDestination {
  if (!claims || claims.adminRole === "none") {
    return null;
  }
  if (claims.mfaSatisfied) {
    return null;
  }
  if (!claims.mfaEnabled) {
    return "/mfa/enroll";
  }
  return "/mfa/challenge";
}
