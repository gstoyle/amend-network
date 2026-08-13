import { describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";

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
});
