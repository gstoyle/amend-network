import { describe, expect, it } from "vitest";
import { memberHasForumAccess } from "@/lib/forum/access";

describe("forum directory listing gate", () => {
  it("lets staff through without a directory listing", () => {
    expect(memberHasForumAccess({ staff: true, directoryVisible: false })).toBe(true);
  });

  it("lets listed members through and blocks unlisted members", () => {
    expect(memberHasForumAccess({ staff: false, directoryVisible: true })).toBe(true);
    expect(memberHasForumAccess({ staff: false, directoryVisible: false })).toBe(false);
  });
});
