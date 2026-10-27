import { describe, expect, it } from "vitest";
import { audienceTokensForGroup, type CohortOption } from "@/lib/cohorts/list";

const NORWAY = "0b4f3c1e-6a43-4c55-9d2e-1f7a8b9c0d11";
const UK = "7d2a9e4b-1c3f-4e8a-b6d5-2a1b3c4d5e66";
const LEAD_27 = "9a8b7c6d-5e4f-4a3b-9c1d-0e9f8a7b6c88";

const cohorts: CohortOption[] = [
  { id: NORWAY, name: "Norway Sept 26", programRole: "pathways", archived: false },
  { id: UK, name: "UK Spring 27", programRole: "pathways", archived: true },
  { id: LEAD_27, name: "LEAD 2027", programRole: "lead", archived: false },
];

/** 014 research §8a: reach = what the group receives; targeted = aimed at the group. */
describe("audienceTokensForGroup", () => {
  it("returns no filter for an empty or unknown group", () => {
    expect(audienceTokensForGroup(undefined, cohorts)).toBeNull();
    expect(audienceTokensForGroup("", cohorts)).toBeNull();
    expect(audienceTokensForGroup("all_authenticated", cohorts)).toBeNull();
    expect(audienceTokensForGroup("cohort:not-a-uuid", cohorts)).toBeNull();
    expect(
      audienceTokensForGroup("cohort:3e5f7a9b-2c4d-4e6f-8a0b-1c2d3e4f5a77", cohorts),
    ).toBeNull();
  });

  it("covers a programme and every one of its cohorts, archived included", () => {
    expect(audienceTokensForGroup("pathways", cohorts)).toEqual({
      reach: ["all_authenticated", "pathways", `cohort:${NORWAY}`, `cohort:${UK}`],
      targeted: ["pathways", `cohort:${NORWAY}`, `cohort:${UK}`],
    });
  });

  it("covers a cohort, its programme, and everyone", () => {
    expect(audienceTokensForGroup(`cohort:${LEAD_27}`, cohorts)).toEqual({
      reach: ["all_authenticated", "lead", `cohort:${LEAD_27}`],
      targeted: [`cohort:${LEAD_27}`],
    });
  });
});
