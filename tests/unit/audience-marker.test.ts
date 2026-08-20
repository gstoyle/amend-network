import { describe, expect, it } from "vitest";
import { audienceLabel } from "@/lib/db/visibility";

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
      label: "Pathways to Change and LEAD",
      restricted: true,
    });
    expect(audienceLabel(["lead", "pathways"])).toEqual({
      label: "Pathways to Change and LEAD",
      restricted: true,
    });
  });

  it("names a single programme when the item is scoped to one", () => {
    expect(audienceLabel(["pathways"])).toEqual({
      label: "Pathways to Change only",
      restricted: true,
    });
    expect(audienceLabel(["lead"])).toEqual({ label: "LEAD only", restricted: true });
  });

  it("falls back to restricted for an empty or unrecognised set", () => {
    expect(audienceLabel([])).toEqual({ label: "Restricted", restricted: true });
    expect(audienceLabel(["something_else"])).toEqual({
      label: "Restricted",
      restricted: true,
    });
  });

  it("reuses the programme names the rest of the product already shows", () => {
    // A member must never see two different names for the same programme.
    expect(audienceLabel(["pathways"]).label).toContain("Pathways to Change");
    expect(audienceLabel(["lead"]).label).toContain("LEAD");
  });
});
