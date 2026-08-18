import { describe, expect, it } from "vitest";
import { memberMatchesQuery } from "@/lib/directory/list";

describe("directory search match (hidden fields excluded, not blanked)", () => {
  const visibleName = {
    firstName: "Ada",
    lastName: "Titled",
    networkLabel: "Pathways to Change",
  };

  it("a query that matches only a hidden title does not keep the member", () => {
    expect(memberMatchesQuery(visibleName, "Coach")).toBe(false);
  });

  it("a query that matches only a hidden DOC label does not keep the member", () => {
    expect(memberMatchesQuery(visibleName, "Test Agency A")).toBe(false);
  });

  it("a visible name match keeps the member even when title and DOC are omitted", () => {
    expect(memberMatchesQuery(visibleName, "Ada")).toBe(true);
    expect(memberMatchesQuery(visibleName, "titled")).toBe(true);
  });

  it("a shown title or DOC label can match", () => {
    expect(
      memberMatchesQuery({ ...visibleName, title: "Coach" }, "Coach"),
    ).toBe(true);
    expect(
      memberMatchesQuery({ ...visibleName, docLabel: "Test Agency A" }, "Agency"),
    ).toBe(true);
  });
});
