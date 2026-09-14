import { describe, expect, it } from "vitest";
import type { SessionClaims } from "@/lib/auth/types";
import { memberProgramRoles, PROGRAM_LABELS, visibilityTokens } from "@/lib/db/visibility";
import { claimsFor } from "@/tests/helpers/prd-matrix";

function withExtras(
  base: SessionClaims,
  programRoles: Array<"pathways" | "lead">,
): SessionClaims {
  return { ...base, programRoles };
}

describe("visibilityTokens extra programme memberships", () => {
  it("keeps Immersion-only tokens when programRoles is omitted", () => {
    expect(visibilityTokens(claimsFor("pathways")!)).toEqual(
      expect.arrayContaining(["all_authenticated", "pathways"]),
    );
    expect(visibilityTokens(claimsFor("pathways")!)).not.toContain("lead");
  });

  it("adds LEAD when the session carries both programme memberships", () => {
    const tokens = visibilityTokens(withExtras(claimsFor("pathways")!, ["pathways", "lead"]));
    expect(tokens).toEqual(expect.arrayContaining(["all_authenticated", "pathways", "lead"]));
  });

  it("memberProgramRoles ignores none and dedupes", () => {
    expect(memberProgramRoles("pathways", ["lead", "pathways", "none"])).toEqual(
      expect.arrayContaining(["pathways", "lead"]),
    );
    expect(memberProgramRoles("none")).toEqual([]);
    expect(PROGRAM_LABELS.pathways).toBe("International Immersion Program");
  });
});
