import type { AdminRole, SessionClaims } from "@/lib/auth/types";
import type { RlsContext } from "@/lib/db/rls";

export const FORUM_STAFF_ROLES: AdminRole[] = ["admin", "super_admin", "moderator"];
export const FORUM_CATEGORY_ADMIN_ROLES: AdminRole[] = ["admin", "super_admin"];

export function isForumStaff(claims: SessionClaims): boolean {
  return FORUM_STAFF_ROLES.includes(claims.adminRole);
}

export function actorRole(claims: SessionClaims): string {
  return claims.adminRole !== "none" ? claims.adminRole : claims.programRole;
}

export function rlsContext(claims: SessionClaims): RlsContext {
  return {
    userId: claims.userId,
    programRole: claims.programRole,
    adminRole: claims.adminRole,
    status: claims.status,
  };
}
