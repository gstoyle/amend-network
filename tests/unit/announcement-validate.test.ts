import { describe, expect, it } from "vitest";
import {
  assertAnnouncementBody,
  isAllowedDestination,
  parseAnnouncementBody,
  parseCtaPair,
  parseVisibility,
} from "@/lib/announcements/validate";

describe("announcement validation (T010)", () => {
  it("accepts allowlisted markdown and http(s) or /app/ destinations", () => {
    expect(assertAnnouncementBody("Hello **world** and _this_")).toBe(
      "Hello **world** and _this_",
    );
    expect(isAllowedDestination("https://example.com/x")).toBe(true);
    expect(isAllowedDestination("/app/resources")).toBe(true);
    expect(parseCtaPair("Read more", "/app/resources")).toEqual({
      label: "Read more",
      url: "/app/resources",
    });
    expect(parseVisibility(["pathways", "all_authenticated", "pathways"])).toEqual([
      "pathways",
      "all_authenticated",
    ]);
  });

  it("rejects HTML, javascript URLs, and unpaired CTAs", () => {
    expect(() => assertAnnouncementBody("Hi <b>there</b>")).toThrowError(/HTML/);
    expect(isAllowedDestination("javascript:alert(1)")).toBe(false);
    expect(isAllowedDestination("//evil.example")).toBe(false);
    expect(() => parseCtaPair("Go", "")).toThrowError(/both/);
    expect(() => parseVisibility([])).toThrowError(/visibility/);
  });

  it("parses bold, emphasis, and allowlisted links without raw HTML", () => {
    const segments = parseAnnouncementBody(
      "See **bold** and _em_ and [docs](/app/resources) plus [bad](javascript:x)",
    );
    expect(segments).toEqual([
      { type: "text", value: "See " },
      { type: "bold", value: "bold" },
      { type: "text", value: " and " },
      { type: "emphasis", value: "em" },
      { type: "text", value: " and " },
      { type: "link", label: "docs", href: "/app/resources" },
      { type: "text", value: " plus " },
      { type: "text", value: "[bad](javascript:x)" },
    ]);
  });
});
