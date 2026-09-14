import { describe, expect, it } from "vitest";
import { audienceLabel } from "@/lib/db/visibility";
import type { ResourceFolderListItem } from "@/lib/resources/folders";
import { buildLibraryView, parseResourceListQuery, type MemberResource } from "@/lib/resources/list";

function folder(
  input: Partial<ResourceFolderListItem> & Pick<ResourceFolderListItem, "id" | "name" | "slug">,
): ResourceFolderListItem {
  return {
    parentId: null,
    parentName: null,
    parentSlug: null,
    sortOrder: 10,
    ...input,
  };
}

function resource(
  input: Partial<MemberResource> & Pick<MemberResource, "id" | "title" | "sourceLabel">,
): MemberResource {
  return {
    previewText: "Preview",
    tags: [],
    folderId: null,
    folderName: null,
    folderSlug: null,
    updatedAt: new Date("2026-09-14T00:00:00.000Z"),
    thumbnailHref: "/app/resources/x/thumbnail",
    fileMimeType: "application/pdf",
    playbackHref: null,
    formatLabel: "PDF",
    sizeLabel: "1 KB",
    audience: audienceLabel(["all_authenticated"]),
    ...input,
  };
}

describe("resource library grouping", () => {
  it("parses collection and folder query params and rejects an invalid folder slug", () => {
    expect(
      parseResourceListQuery({ source: "Members", folder: "policies", tag: "Training" }),
    ).toMatchObject({ source: "Members", folder: "policies", tags: ["Training"] });
    expect(parseResourceListQuery({ folder: "Not A Folder", source: "Partner Org" })).toEqual({
      sort: "newest",
    });
  });

  it("splits unfiled files into Amend vs Members and counts nested folder items", () => {
    const policies = folder({ id: "p", name: "Policies", slug: "policies" });
    const australia = folder({
      id: "a",
      name: "Australia",
      slug: "australia",
      parentId: "p",
      parentName: "Policies",
      parentSlug: "policies",
    });
    const view = buildLibraryView({
      folders: [policies, australia],
      resources: [
        resource({ id: "1", title: "Endorsed", sourceLabel: "Amend" }),
        resource({ id: "2", title: "Peer", sourceLabel: "Members" }),
        resource({
          id: "3",
          title: "AU policy",
          sourceLabel: "Amend",
          folderId: "a",
          folderName: "Australia",
          folderSlug: "australia",
        }),
      ],
    });
    expect(view.sections.map((section) => section.source)).toEqual(["Amend", "Members"]);
    expect(view.sections[0]?.folders).toEqual([
      { id: "p", name: "Policies", slug: "policies", resourceCount: 1 },
    ]);
    expect(view.sections[0]?.resources.map((row) => row.title)).toEqual(["Endorsed"]);
    expect(view.sections[1]?.resources.map((row) => row.title)).toEqual(["Peer"]);
  });

  it("shows a location folder's own files, not the parent's", () => {
    const policies = folder({ id: "p", name: "Policies", slug: "policies" });
    const australia = folder({
      id: "a",
      name: "Australia",
      slug: "australia",
      parentId: "p",
      parentName: "Policies",
      parentSlug: "policies",
    });
    const view = buildLibraryView({
      folderSlug: "australia",
      folders: [policies, australia],
      resources: [
        resource({
          id: "1",
          title: "Parent note",
          sourceLabel: "Amend",
          folderId: "p",
          folderSlug: "policies",
          folderName: "Policies",
        }),
        resource({
          id: "2",
          title: "AU policy",
          sourceLabel: "Amend",
          folderId: "a",
          folderSlug: "australia",
          folderName: "Australia",
        }),
      ],
    });
    expect(view.currentFolder?.slug).toBe("australia");
    expect(view.parentFolder?.slug).toBe("policies");
    expect(view.sections[0]?.resources.map((row) => row.title)).toEqual(["AU policy"]);
    expect(view.sections[0]?.folders).toEqual([]);
  });
});
