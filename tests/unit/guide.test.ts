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

  it("documents launch library collections, directory-gated forum, and Immersion naming", () => {
    const member = claimsFor("pathways")!;
    const resources = JSON.stringify(getVisibleGuideArticle(member, "resources"));
    expect(resources).toMatch(/From Amend/);
    expect(resources).toMatch(/Shared by members/);
    expect(resources).toMatch(/cannot upload/);
    expect(resources).toMatch(/Folders nest one level/);

    const forum = JSON.stringify(getVisibleGuideArticle(member, "forum"));
    expect(forum).toMatch(/join the member directory/);
    expect(forum).toMatch(/no all-members room/);
    expect(forum).toMatch(/underline/);

    const directory = JSON.stringify(getVisibleGuideArticle(member, "directory"));
    expect(directory).toMatch(/access to the forum/);
    expect(directory).toMatch(/Staff-only Amend accounts/);

    const account = JSON.stringify(getVisibleGuideArticle(member, "your-account"));
    expect(account).toMatch(/International Immersion Program/);
    expect(account).toMatch(/both programmes/);

    const publishing = JSON.stringify(getVisibleGuideArticle(claimsFor("admin")!, "publishing"));
    expect(publishing).toMatch(/Shared by members/);
    expect(publishing).toMatch(/all-members room is paused/);
  });
});
