import { describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";

function session(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    sessionId: "session",
    userId: "00000000-0000-4000-8000-000000000001",
    programRole: "pathways",
    adminRole: "none",
    status: "active",
    mfaEnabled: false,
    mfaSatisfied: false,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe("requireRole (FR-007)", () => {
  it("denies a missing session without leaking account state", () => {
    expect(() => requireRole(null, { statuses: ["active"] })).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("does not accept a client-supplied role in place of a session", () => {
    expect(() =>
      requireRole(null, {
        statuses: ["active"],
        clientProgramRole: "pathways",
      }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("accepts an extra programme membership when checking program", () => {
    const claims = requireRole(session({ programRoles: ["pathways", "lead"] }), {
      program: "lead",
    });
    expect(claims.programRole).toBe("pathways");
  });
});
