import type { AdminRole, SessionClaims } from "@/lib/auth/types";

export const ADMIN_ROLES: AdminRole[] = ["super_admin", "admin", "moderator"];

/**
 * PRD §5.1 still requires TOTP for administrative roles. Enrollment stays
 * available; this flag only controls whether admin routes force it.
 * Flip to `true` to restore the gate.
 */
export const ADMIN_MFA_REQUIRED = false;

export type AdminMfaDestination = "/mfa/enroll" | "/mfa/challenge" | null;

/** Optional setup routing: enroll, challenge, or already satisfied. Members get null. */
export function mfaSetupDestination(claims: SessionClaims | null): AdminMfaDestination {
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

/** Forced destination before `/admin`. Null while MFA is optional. */
export function adminMfaDestination(claims: SessionClaims | null): AdminMfaDestination {
  if (!ADMIN_MFA_REQUIRED) {
    return null;
  }
  return mfaSetupDestination(claims);
}
