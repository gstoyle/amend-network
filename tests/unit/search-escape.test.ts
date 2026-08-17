import { describe, expect, it } from "vitest";
import { escapeIlike } from "@/lib/resources/list";

describe("ILIKE keyword escape", () => {
  it("escapes percent, underscore, and backslash so they are literals", () => {
    expect(escapeIlike("100%")).toBe("100\\%");
    expect(escapeIlike("a_b")).toBe("a\\_b");
    expect(escapeIlike("a\\b")).toBe("a\\\\b");
    expect(escapeIlike("%_\\")).toBe("\\%\\_\\\\");
  });
});
