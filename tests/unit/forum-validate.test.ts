import { describe, expect, it } from "vitest";
import { parseAnnouncementBody } from "@/lib/announcements/validate";
import {
  FORUM_RATE_LIMIT_MESSAGE,
  assertCategorySlug,
  assertForumBody,
  assertForumReason,
  assertForumTitle,
  authorLabelFrom,
  forumErrorMessage,
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
  });

  it("parses the same allowlisted markdown as announcements", () => {
    expect(parseAnnouncementBody("See **bold** and _em_")).toEqual([
      { type: "text", value: "See " },
      { type: "bold", value: "bold" },
      { type: "text", value: " and " },
      { type: "emphasis", value: "em" },
    ]);
  });

  it("exports the public rate-limit copy", () => {
    expect(FORUM_RATE_LIMIT_MESSAGE).toBe("Try again later.");
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
  });
});
