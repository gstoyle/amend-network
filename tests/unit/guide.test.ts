import { describe, expect, it } from "vitest";
import {
  articlesByCategory,
  getVisibleGuideArticle,
  listVisibleGuideArticles,
  searchGuideArticles,
} from "@/lib/guide/catalog";
import { claimsFor } from "@/tests/helpers/prd-matrix";

describe("guide catalog", () => {
  it("shows member articles to Pathways and hides staff tools", () => {
    const claims = claimsFor("pathways")!;
    const slugs = listVisibleGuideArticles(claims).map((article) => article.slug);
    expect(slugs).toContain("signing-in");
    expect(slugs).toContain("forum");
    expect(slugs).not.toContain("staff-overview");
    expect(slugs).not.toContain("analytics-and-audit");
    expect(getVisibleGuideArticle(claims, "staff-overview")).toBeNull();
  });

  it("shows staff articles to a moderator but not content-admin publishing tools", () => {
    const claims = claimsFor("moderator")!;
    const slugs = listVisibleGuideArticles(claims).map((article) => article.slug);
    expect(slugs).toContain("forum-moderation");
    expect(slugs).toContain("staff-overview");
    expect(slugs).not.toContain("publishing");
    expect(slugs).not.toContain("members-and-invites");
    expect(getVisibleGuideArticle(claims, "publishing")).toBeNull();
  });

  it("shows publishing and audit articles to an admin", () => {
    const claims = claimsFor("admin")!;
    expect(getVisibleGuideArticle(claims, "publishing")?.title).toMatch(/Publishing/);
    expect(getVisibleGuideArticle(claims, "analytics-and-audit")).not.toBeNull();
  });

  it("search matches keywords and ignores articles the caller cannot see", () => {
    const member = claimsFor("lead")!;
    const hits = searchGuideArticles(member, "ics capacity");
    expect(hits.map((article) => article.slug)).toEqual(["events"]);
    expect(searchGuideArticles(member, "posthog").map((article) => article.slug)).toEqual([]);
    expect(
      searchGuideArticles(claimsFor("admin")!, "posthog").map((article) => article.slug),
    ).toContain("analytics-and-audit");
  });

  it("groups visible articles under categories and omits empty staff groups for members", () => {
    const groups = articlesByCategory(listVisibleGuideArticles(claimsFor("pathways")!));
    expect(groups.map((group) => group.category.id)).toEqual([
      "start",
      "library",
      "community",
      "account",
    ]);
  });
});
