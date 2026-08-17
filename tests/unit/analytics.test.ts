import { describe, expect, it } from "vitest";
import { track } from "@/lib/analytics/track";

describe("analytics tracker (T047 / FR-021)", () => {
  it("no-ops without POSTHOG_KEY and accepts opaque ids plus role labels only", () => {
    expect(() =>
      track("resource_viewed", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
      }),
    ).not.toThrow();
    expect(() =>
      track("resource_downloaded", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
      }),
    ).not.toThrow();
  });

  it("rejects extra fields so titles and keys cannot be sent", () => {
    expect(() =>
      track("resource_viewed", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        title: "Secret handbook",
      } as never),
    ).toThrowError(/analytics payload/);
  });

  it("accepts announcement events with opaque ids and rejects headline copy", () => {
    expect(() =>
      track("announcement_impression", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        announcementId: "00000000-0000-4000-8000-000000000002",
      }),
    ).not.toThrow();
    expect(() =>
      track("announcement_cta_click", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        announcementId: "00000000-0000-4000-8000-000000000002",
        ctaSlot: "primary",
      }),
    ).not.toThrow();
    expect(() =>
      track("announcement_cta_click", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        headline: "Do not send copy",
      } as never),
    ).toThrowError(/analytics payload/);
  });
});
