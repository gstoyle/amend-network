import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import type { AdminRole } from "@/lib/auth/types";
import { listPendingRegistrations } from "@/lib/registration/approve";
import { addDocAffiliation } from "@/lib/registration/doc-affiliations";
import { claimsFor } from "@/tests/helpers/prd-matrix";

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

describe("unauthorized roles are denied on delivered handlers (FR-026)", () => {
  it("member and admin routes reject a missing session at layer 1", () => {
    expect(authorizedFor("/app")).toBe(false);
    expect(authorizedFor("/app/anything")).toBe(false);
    expect(authorizedFor("/admin")).toBe(false);
    expect(authorizedFor("/login")).toBe(true);
  });

  it("member home requireRole denies anonymous, pending, and denied sessions", () => {
    expect(() => requireRole(null)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);
    const denied = claimsFor("pathways")!;
    expect(() => requireRole({ ...denied, status: "denied" })).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("admin-only requireRole denies Pathways and LEAD members", () => {
    expect(() =>
      requireRole(claimsFor("pathways"), { admin: ["admin", "super_admin"] }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() =>
      requireRole(claimsFor("lead"), { admin: ["admin", "super_admin"] }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(requireRole(claimsFor("admin"), { admin: ["admin", "super_admin"] }).adminRole).toBe(
      "admin",
    );
  });

  it("program-scoped requireRole denies the other program", () => {
    expect(() => requireRole(claimsFor("pathways"), { program: "lead" })).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), { program: "pathways" })).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("audit-log read denies members, moderator, and admin without mfa_satisfied", () => {
    expect(authorizedFor("/admin/audit-log")).toBe(false);
    expect(authorizedFor("/admin/audit-log", "session-id")).toBe(true);

    const auditRead = { admin: ["super_admin", "admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("pathways"), auditRead)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), auditRead)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("moderator"), auditRead)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("admin"), auditRead)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(
      requireRole(
        { ...claimsFor("admin")!, mfaSatisfied: true },
        auditRead,
      ).adminRole,
    ).toBe("admin");
  });

  it("affiliations management denies Moderator, Pathways, LEAD, and Pending (FR-021)", async () => {
    expect(authorizedFor("/admin/users/affiliations")).toBe(false);
    expect(authorizedFor("/admin/users/affiliations", "session-id")).toBe(true);

    const affiliations = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), affiliations)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), affiliations)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), affiliations)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pending"), affiliations)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, affiliations).adminRole,
    ).toBe("admin");

    const input = {
      label: "unauthorized-should-not-insert",
      ip: "127.0.0.1",
      userAgent: "vitest-affiliations-deny",
      clientAdminRole: "admin" as const,
      clientMfaSatisfied: true,
    };
    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(addDocAffiliation(claimsFor(role), input)).rejects.toThrowError(
        AUTH_FAILURE_MESSAGE,
      );
    }
  });

  it("pending queue denies Moderator, Pathways, LEAD, and Pending (FR-021)", async () => {
    expect(authorizedFor("/admin/users/pending")).toBe(false);
    expect(authorizedFor("/admin/users/pending", "session-id")).toBe(true);

    const pendingQueue = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), pendingQueue)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), pendingQueue)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), pendingQueue)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pending"), pendingQueue)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, pendingQueue).adminRole,
    ).toBe("admin");

    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(
        listPendingRegistrations(claimsFor(role), {
          clientAdminRole: "admin",
          clientMfaSatisfied: true,
        }),
      ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    }
  });
});
