import { describe, expect, it } from "vitest";
import type { SessionClaims } from "@/lib/auth/types";
import {
  cohortIdFromToken,
  cohortToken,
  isCohortToken,
  memberProgramRoles,
  parseVisibilityTokens,
  PROGRAM_LABELS,
  VISIBILITY_EMPTY_MESSAGE,
  VISIBILITY_INVALID_MESSAGE,
  visibilityTokens,
} from "@/lib/db/visibility";
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
    expect(PROGRAM_LABELS.pathways).toBe("Global Learning Experiences");
  });
});

const COHORT_A = "0b4f3c1e-6a43-4c55-9d2e-1f7a8b9c0d11";
const COHORT_B = "7d2a9e4b-1c3f-4e8a-b6d5-2a1b3c4d5e66";

describe("visibilityTokens cohort memberships (014 T005)", () => {
  it("adds a cohort token for each cohort on the session", () => {
    const claims = { ...claimsFor("pathways")!, cohortIds: [COHORT_A, COHORT_B] };
    expect(visibilityTokens(claims)).toEqual(
      expect.arrayContaining([cohortToken(COHORT_A), cohortToken(COHORT_B), "pathways"]),
    );
  });

  it("carries no cohort tokens when cohortIds is absent", () => {
    expect(visibilityTokens(claimsFor("lead")!).some(isCohortToken)).toBe(false);
  });

  it("carries nothing for an inactive session, even with cohorts", () => {
    const claims = { ...claimsFor("pathways")!, status: "deactivated" as const, cohortIds: [COHORT_A] };
    expect(visibilityTokens(claims)).toEqual([]);
  });
});

describe("parseVisibilityTokens (014 T005)", () => {
  it("accepts fixed tokens and well-formed cohort tokens, trimmed, lowercased, and deduped", () => {
    expect(
      parseVisibilityTokens([" pathways ", `COHORT:${COHORT_A.toUpperCase()}`, `cohort:${COHORT_A}`]),
    ).toEqual(["pathways", `cohort:${COHORT_A}`]);
  });

  it("rejects an empty list", () => {
    expect(() => parseVisibilityTokens([])).toThrowError(VISIBILITY_EMPTY_MESSAGE);
  });

  it.each([
    ["unknown token", "moderator"],
    ["cohort without id", "cohort:"],
    ["cohort with non-uuid", "cohort:norway-sept-26"],
    ["cohort with trailing text", `cohort:${COHORT_A};drop`],
    ["non-string", 42],
  ])("rejects %s", (_name, value) => {
    expect(() => parseVisibilityTokens([value])).toThrowError(VISIBILITY_INVALID_MESSAGE);
  });

  it("round-trips cohort ids through tokens", () => {
    const token = cohortToken(COHORT_B);
    expect(isCohortToken(token)).toBe(true);
    expect(cohortIdFromToken(token)).toBe(COHORT_B);
  });
});
