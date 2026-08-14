import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { adminMfaDestination } from "@/lib/auth/admin-mfa";
import { requireRole } from "@/lib/auth/requireRole";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const ADMIN_ROLES = ["super_admin", "admin", "moderator"] as const;

function authorizedFor(pathname: string, sessionId?: string): boolean {
  const callback = authConfig.callbacks?.authorized;
  if (!callback) {
    throw new Error("authorized callback missing");
  }
  const result = callback({
    auth: sessionId ? { sessionId } : null,
    request: { nextUrl: { pathname } },
  } as never);
  return result === true;
}

describe("/admin requires mfa_satisfied from the signed session (US3 / FR-012)", () => {
  it("denies an admin role when the session mfa_satisfied claim is false", () => {
    const admin = claimsFor("admin");
    expect(admin?.mfaSatisfied).toBe(false);
    expect(() =>
      requireRole(admin, { admin: [...ADMIN_ROLES], mfa: true }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("ignores a client-supplied mfaSatisfied flag", () => {
    const admin = claimsFor("admin");
    expect(() =>
      requireRole(admin, {
        admin: [...ADMIN_ROLES],
        mfa: true,
        clientMfaSatisfied: true,
      }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("allows an admin only when the signed session already has mfa_satisfied", () => {
    const admin = { ...claimsFor("admin")!, mfaSatisfied: true };
    expect(requireRole(admin, { admin: [...ADMIN_ROLES], mfa: true }).adminRole).toBe(
      "admin",
    );
  });

  it("sends MFA-off admins to enroll and enrolled-unsatisfied admins to challenge", () => {
    const enroll = claimsFor("admin");
    expect(adminMfaDestination(enroll)).toBe("/mfa/enroll");

    const challenge = {
      ...claimsFor("admin")!,
      mfaEnabled: true,
      mfaSatisfied: false,
    };
    expect(adminMfaDestination(challenge)).toBe("/mfa/challenge");

    const satisfied = {
      ...claimsFor("admin")!,
      mfaEnabled: true,
      mfaSatisfied: true,
    };
    expect(adminMfaDestination(satisfied)).toBeNull();
  });

  it("does not prompt a Pathways member for MFA", () => {
    const pathways = claimsFor("pathways");
    expect(adminMfaDestination(pathways)).toBeNull();
    expect(requireRole(pathways).programRole).toBe("pathways");
    expect(() =>
      requireRole(pathways, { admin: [...ADMIN_ROLES], mfa: true }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("still requires a session cookie on /admin at layer 1", () => {
    expect(authorizedFor("/admin")).toBe(false);
    expect(authorizedFor("/admin/anything")).toBe(false);
    expect(authorizedFor("/admin", "session-id")).toBe(true);
  });
});
