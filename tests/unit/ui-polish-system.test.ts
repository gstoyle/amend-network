import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

describe("shared UI polish system", () => {
  it("gives fields a distinct token surface and shared checkbox chrome", () => {
    const tokens = read("app/tokens.css");
    const theme = read("tailwind.config.ts");
    const input = read("components/ui/input.tsx");

    expect(tokens).toContain("--field:");
    expect(theme).toContain('field: "var(--field)"');
    expect(input).toContain("bg-field");
    expect(input).toContain("shadow-xs");
    expect(input).toMatch(/export const checkboxClassName/);
  });

  it("exports shared form surface, grid, field, and inset-panel patterns", () => {
    const card = read("components/ui/card.tsx");

    expect(card).toMatch(/export const formSurfaceClassName/);
    expect(card).toMatch(/export const formGridClassName/);
    expect(card).toMatch(/export const formFieldClassName/);
    expect(card).toMatch(/export const formInsetClassName/);
    expect(card).toContain("gap-4 sm:gap-5");
    expect(card).toContain("gap-1.5");
  });

  it.each([
    "components/event-form.tsx",
    "components/announcement-form.tsx",
    "components/resource-form.tsx",
  ])("%s uses the shared responsive form grid", (relative) => {
    const source = read(relative);
    expect(source).toContain("formGridClassName");
    expect(source).toContain("formFieldClassName");
    expect(source).not.toContain("max-w-2xl");
  });

  it("polishes the named forum and privacy surfaces with shared patterns", () => {
    const adminForum = read("app/(admin)/admin/forum/page.tsx");
    const newThread = read("app/(member)/app/forum/[slug]/new/page.tsx");
    const thread = read("app/(member)/app/forum/t/[id]/page.tsx");
    const privacy = read("components/directory-privacy-form.tsx");

    expect(adminForum).toContain("formSurfaceClassName");
    expect(adminForum).toContain("SectionHeader");
    expect(newThread).toContain("formSurfaceClassName");
    expect(thread).toContain("formSurfaceClassName");
    expect(thread).toContain("<details");
    expect(thread).toContain("ActionDisclosure");
    expect(thread).not.toContain("Flag this post");
    expect(privacy).toContain("formSurfaceClassName");
    expect(privacy).toContain("checkboxClassName");
    expect(privacy).not.toContain("min-h-touch min-w-touch");
  });
});
