import { describe, expect, it } from "vitest";
import { parseAnnouncementBody } from "@/lib/announcements/validate";
import {
  FORUM_CATEGORY_VISIBILITY_OPTIONS,
  FORUM_LISTING_REQUIRED_MESSAGE,
  FORUM_NAME_REQUIRED_MESSAGE,
  FORUM_RATE_LIMIT_MESSAGE,
  assertCategorySlug,
  assertForumBody,
  assertForumReason,
  assertForumTitle,
  authorLabelFrom,
  forumCategoryAudience,
  forumErrorMessage,
  hasDisplayableForumName,
  isPausedForumCategory,
  parseForumCategoryVisibility,
} from "@/lib/forum/validate";

describe("forum validate", () => {
  it("accepts allowlisted bodies and rejects HTML", () => {
    expect(assertForumBody("Hello **world**")).toBe("Hello **world**");
    expect(() => assertForumBody("Hi <b>there</b>")).toThrowError(/HTML/);
    expect(() => assertForumTitle("")).toThrowError(/1 to 120/);
    expect(() => assertForumReason("")).toThrowError(/1 and 500/);
    expect(() => assertCategorySlug("Not A Slug")).toThrowError(/lowercase/);
  });

  it("renders author labels without a last name as Member when both are empty", () => {
    expect(authorLabelFrom("", "")).toBe("Member");
    expect(authorLabelFrom("Ada", "Lovelace")).toBe("Ada L.");
    expect(authorLabelFrom("Ada", "")).toBe("Ada");
    expect(hasDisplayableForumName("", "")).toBe(false);
    expect(hasDisplayableForumName("Ada", "")).toBe(true);
  });

  it("parses the same allowlisted markdown as announcements", () => {
    expect(parseAnnouncementBody("See **bold** and _em_ and ++line++")).toEqual([
      { type: "text", value: "See " },
      { type: "bold", value: "bold" },
      { type: "text", value: " and " },
      { type: "emphasis", value: "em" },
      { type: "text", value: " and " },
      { type: "underline", value: "line" },
    ]);
  });

  it("exports the public rate-limit copy", () => {
    expect(FORUM_RATE_LIMIT_MESSAGE).toBe("Try again later.");
  });

  it("rejects cross-programme category visibility while launch rooms stay programme-scoped", () => {
    expect(parseForumCategoryVisibility(["pathways"])).toEqual(["pathways"]);
    expect(parseForumCategoryVisibility(["lead", "pathways"])).toEqual(["lead", "pathways"]);
    expect(() => parseForumCategoryVisibility(["all_authenticated"])).toThrowError(
      /Cross-programme rooms are paused/,
    );
    expect(() => parseForumCategoryVisibility(["all_authenticated", "pathways"])).toThrowError(
      /paused/,
    );
    expect(isPausedForumCategory([])).toBe(true);
    expect(isPausedForumCategory(["pathways"])).toBe(false);
    expect(FORUM_CATEGORY_VISIBILITY_OPTIONS.map((option) => option.value)).toEqual([
      "pathways",
      "lead",
    ]);
    expect(forumCategoryAudience([])).toEqual({ label: "Paused", restricted: true });
  });

  it("does not expose database errors in forum form responses", () => {
    const fallback = "Could not start this thread.";
    const internal = new Error(
      'Invalid `prisma.forumThread.create()` invocation: new row violates row-level security policy',
    );

    expect(forumErrorMessage(internal, fallback, [FORUM_RATE_LIMIT_MESSAGE])).toBe(fallback);
    expect(
      forumErrorMessage(
        new Error(FORUM_RATE_LIMIT_MESSAGE),
        fallback,
        [FORUM_RATE_LIMIT_MESSAGE],
      ),
    ).toBe(FORUM_RATE_LIMIT_MESSAGE);
    expect(
      forumErrorMessage(
        new Error(FORUM_LISTING_REQUIRED_MESSAGE),
        fallback,
        [FORUM_LISTING_REQUIRED_MESSAGE],
      ),
    ).toBe(FORUM_LISTING_REQUIRED_MESSAGE);
    expect(FORUM_NAME_REQUIRED_MESSAGE).toMatch(/name/);
  });
});
