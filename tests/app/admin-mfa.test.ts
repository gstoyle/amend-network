import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import {
  ADMIN_MFA_REQUIRED,
  adminMfaDestination,
  mfaSetupDestination,
} from "@/lib/auth/admin-mfa";
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

describe("/admin MFA gate (US3 / FR-012)", () => {
  it("does not force MFA on admin routes while ADMIN_MFA_REQUIRED is off", () => {
    expect(ADMIN_MFA_REQUIRED).toBe(false);
    const admin = claimsFor("admin");
    expect(admin?.mfaSatisfied).toBe(false);
    expect(requireRole(admin, { admin: [...ADMIN_ROLES], mfa: true }).adminRole).toBe("admin");
    expect(adminMfaDestination(admin)).toBeNull();
  });

  it("ignores a client-supplied mfaSatisfied flag", () => {
    const admin = claimsFor("admin");
    expect(
      requireRole(admin, {
        admin: [...ADMIN_ROLES],
        mfa: true,
        clientMfaSatisfied: true,
      }).adminRole,
    ).toBe("admin");
  });

  it("keeps optional enroll/challenge routing for staff who choose to set MFA up", () => {
    const enroll = claimsFor("admin");
    expect(mfaSetupDestination(enroll)).toBe("/mfa/enroll");

    const challenge = {
      ...claimsFor("admin")!,
      mfaEnabled: true,
      mfaSatisfied: false,
    };
    expect(mfaSetupDestination(challenge)).toBe("/mfa/challenge");

    const satisfied = {
      ...claimsFor("admin")!,
      mfaEnabled: true,
      mfaSatisfied: true,
    };
    expect(mfaSetupDestination(satisfied)).toBeNull();
  });

  it("does not prompt a Pathways member for MFA", () => {
    const pathways = claimsFor("pathways");
    expect(adminMfaDestination(pathways)).toBeNull();
    expect(mfaSetupDestination(pathways)).toBeNull();
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
