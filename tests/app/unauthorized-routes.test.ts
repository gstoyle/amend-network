import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
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
});
