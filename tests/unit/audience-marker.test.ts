import { describe, expect, it } from "vitest";
import { audienceLabel, PROGRAM_LABELS } from "@/lib/db/visibility";

/**
 * 012 T004 — FR-010, FR-031, FR-032.
 * The audience marker is a label over content the member already receives.
 * It never gates, so `restricted` only ever selects a tone.
 */
describe("audienceLabel (012 T004)", () => {
  it("treats all_authenticated as unrestricted regardless of what accompanies it", () => {
    expect(audienceLabel(["all_authenticated"])).toEqual({
      label: "All members",
      restricted: false,
    });
    expect(audienceLabel(["all_authenticated", "pathways", "lead"])).toEqual({
      label: "All members",
      restricted: false,
    });
  });

  it("names both programmes when the item is scoped to both and not to everyone", () => {
    expect(audienceLabel(["pathways", "lead"])).toEqual({
      label: `${PROGRAM_LABELS.pathways} and ${PROGRAM_LABELS.lead}`,
      restricted: true,
    });
    expect(audienceLabel(["lead", "pathways"])).toEqual({
      label: `${PROGRAM_LABELS.pathways} and ${PROGRAM_LABELS.lead}`,
      restricted: true,
    });
  });

  it("names a single programme when the item is scoped to one", () => {
    expect(audienceLabel(["pathways"])).toEqual({
      label: `${PROGRAM_LABELS.pathways} only`,
      restricted: true,
    });
    expect(audienceLabel(["lead"])).toEqual({ label: `${PROGRAM_LABELS.lead} only`, restricted: true });
  });

  it("falls back to restricted for an empty or unrecognised set", () => {
    expect(audienceLabel([])).toEqual({ label: "Restricted", restricted: true });
    expect(audienceLabel(["something_else"])).toEqual({
      label: "Restricted",
      restricted: true,
    });
  });

  it("names cohorts when the item targets cohorts only (014 T005)", () => {
    const a = "0b4f3c1e-6a43-4c55-9d2e-1f7a8b9c0d11";
    const b = "7d2a9e4b-1c3f-4e8a-b6d5-2a1b3c4d5e66";
    const c = "3e5f7a9b-2c4d-4e6f-8a0b-1c2d3e4f5a77";
    const d = "9a8b7c6d-5e4f-4a3b-9c1d-0e9f8a7b6c88";
    const names = new Map([
      [a, "Norway Sept 26"],
      [b, "UK Spring 27"],
      [c, "Norway April 27"],
      [d, "LEAD 2027"],
    ]);
    expect(audienceLabel([`cohort:${a}`], names)).toEqual({
      label: "Norway Sept 26 only",
      restricted: true,
    });
    expect(audienceLabel([`cohort:${b}`, `cohort:${a}`], names).label).toBe(
      "Norway Sept 26 and UK Spring 27 only",
    );
    expect(audienceLabel([`cohort:${a}`, `cohort:${b}`, `cohort:${c}`], names).label).toBe(
      "Norway April 27, Norway Sept 26 and UK Spring 27 only",
    );
    expect(
      audienceLabel([`cohort:${a}`, `cohort:${b}`, `cohort:${c}`, `cohort:${d}`], names).label,
    ).toBe("LEAD 2027, Norway April 27 and 2 more only");
  });

  it("lets a programme or everyone outrank cohort tokens", () => {
    const a = "0b4f3c1e-6a43-4c55-9d2e-1f7a8b9c0d11";
    expect(audienceLabel(["pathways", `cohort:${a}`]).label).toBe(`${PROGRAM_LABELS.pathways} only`);
    expect(audienceLabel(["all_authenticated", `cohort:${a}`]).restricted).toBe(false);
  });

  it("uses a neutral label when cohort names are unavailable", () => {
    expect(audienceLabel(["cohort:0b4f3c1e-6a43-4c55-9d2e-1f7a8b9c0d11"])).toEqual({
      label: "Selected cohorts",
      restricted: true,
    });
  });

  it("does not surface Pathways as a member-facing programme name", () => {
    expect(PROGRAM_LABELS.pathways).toBe("Global Learning Experiences");
    expect(PROGRAM_LABELS.pathways).not.toMatch(/Pathways|Immersion/i);
  });
});
