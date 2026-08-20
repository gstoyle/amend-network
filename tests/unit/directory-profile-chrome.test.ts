import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

const PAGES = [
  "app/(member)/app/directory/page.tsx",
  "app/(member)/app/directory/[id]/page.tsx",
  "app/(member)/app/profile/privacy/page.tsx",
  "app/(member)/app/profile/sessions/page.tsx",
] as const;

const PRESENTATION = [
  ...PAGES,
  "components/directory-search-form.tsx",
  "components/directory-privacy-form.tsx",
  "components/directory-privacy-prompt.tsx",
  "components/member-initials.tsx",
] as const;

const COLOUR_PREFIXES = [
  "bg",
  "text",
  "border",
  "divide",
  "decoration",
  "ring",
  "fill",
  "stroke",
  "outline",
  "shadow",
] as const;

describe("directory and profile chrome (visual-only restyle)", () => {
  it.each(PAGES)("%s uses PageHeader and does not add outer p-6", (file) => {
    const source = read(file);
    expect(source).toContain("PageHeader");
    expect(source).toContain("@/components/page-header");
    expect(source).not.toMatch(/className="[^"]*\bp-6\b/);
  });

  it.each(PRESENTATION)("%s carries no literal colour, size, or arbitrary value", (file) => {
    const source = read(file);
    expect(source, "hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source, "rgb/hsl colour").not.toMatch(/\b(?:rgba?|hsla?)\(/);
    expect(source, "arbitrary Tailwind value").not.toMatch(/\b[a-z-]+-\[[^\]]+\]/);
  });

  it.each(PRESENTATION)("%s does not combine a colour utility with an opacity modifier", (file) => {
    const source = read(file);
    const pattern = new RegExp(`\\b(?:${COLOUR_PREFIXES.join("|")})-[a-z-]+\\/\\d+`);
    expect(source).not.toMatch(pattern);
  });

  it("does not invent /app/profile or /app/profile/edit — those routes are not in this product", () => {
    for (const file of PAGES) {
      const source = read(file);
      expect(source).not.toMatch(/href=["']\/app\/profile["']/);
      expect(source).not.toMatch(/\/app\/profile\/edit/);
    }
  });

  it("privacy form keeps the 007 field names, action, and listing copy", () => {
    const source = read("components/directory-privacy-form.tsx");
    expect(source).toContain('name="listing"');
    expect(source).toContain('name="showTitle"');
    expect(source).toContain('name="showDocAffiliation"');
    expect(source).toContain('name="showEmail"');
    expect(source).toContain("Appear in the member directory");
    expect(source).toContain("Hiding a field");
    expect(source).toContain("including staff");
  });

  it("directory search stays a GET to /app/directory with q and the existing control id", () => {
    const source = read("components/directory-search-form.tsx");
    expect(source).toContain('action="/app/directory"');
    expect(source).toContain('method="get"');
    expect(source).toContain('name="q"');
    expect(source).toContain('id="directory-search"');
    expect(source).toContain("<Input");
  });

  it("buttonVariants stays exported with horizontal padding so linked actions keep their chrome", () => {
    const source = read("components/ui/button.tsx");
    expect(source).toMatch(/export const buttonVariants/);
    expect(source).toContain("px-4");
    expect(source).toContain("min-h-touch");
  });

  it("member initials keep the 44px token floor (008 lock) after the token restyle", () => {
    const source = read("components/member-initials.tsx");
    expect(source).toContain("min-h-touch");
    expect(source).toContain("min-w-touch");
    expect(source).toContain("bg-primary-subtle");
    expect(source).not.toMatch(/\b(?:bg|text|border)-[a-z-]+\/\d+/);
  });
});
