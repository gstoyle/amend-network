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

  it("accepts event viewed and RSVP payloads and rejects description, location, and virtualLink", () => {
    expect(() =>
      track("event_viewed", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        eventId: "00000000-0000-4000-8000-000000000002",
      }),
    ).not.toThrow();
    expect(() =>
      track("event_rsvp", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        eventId: "00000000-0000-4000-8000-000000000002",
        rsvpStatus: "waitlist",
      }),
    ).not.toThrow();
    expect(() =>
      track("event_rsvp", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        eventId: "00000000-0000-4000-8000-000000000002",
        rsvpStatus: "maybe",
      }),
    ).not.toThrow();
    expect(() =>
      track("event_rsvp", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        eventId: "00000000-0000-4000-8000-000000000002",
        rsvpStatus: "no",
      }),
    ).not.toThrow();
    expect(() =>
      track("event_rsvp", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        eventId: "00000000-0000-4000-8000-000000000002",
        rsvpStatus: "attending" as never,
      }),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("event_rsvp", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        eventId: "00000000-0000-4000-8000-000000000002",
        rsvpStatus: "yes",
        description: "secret",
      } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("event_viewed", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        location: "123 Main",
      } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("event_rsvp", {
        distinctId: "00000000-0000-4000-8000-000000000001",
        programRole: "pathways",
        adminRole: "none",
        virtualLink: "https://meet.example.test/secret",
      } as never),
    ).toThrowError(/analytics payload/);
  });

  it("accepts directory_search and directory_profile_viewed with opaque ids and rejects query, name, email, title, and DOC", () => {
    const opaque = {
      distinctId: "00000000-0000-4000-8000-000000000001",
      programRole: "pathways",
      adminRole: "none",
    };
    expect(() => track("directory_search", opaque)).not.toThrow();
    expect(() =>
      track("directory_profile_viewed", {
        ...opaque,
        viewedUserId: "00000000-0000-4000-8000-000000000002",
      }),
    ).not.toThrow();
    expect(() =>
      track("directory_search", { ...opaque, query: "Ada Subject" } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("directory_search", { ...opaque, name: "Ada Subject" } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("directory_profile_viewed", { ...opaque, email: "ada@example.com" } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("directory_search", { ...opaque, title: "Coach" } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("directory_profile_viewed", { ...opaque, doc: "Test Agency A" } as never),
    ).toThrowError(/analytics payload/);
  });
});
