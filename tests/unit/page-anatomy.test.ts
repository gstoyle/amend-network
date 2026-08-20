import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Presentation added by 012. Every one must stay server-rendered and token-only. */
const PRESENTATION_FILES = [
  "components/page-header.tsx",
  "components/section-header.tsx",
  "components/reserved-panel.tsx",
  "components/event-row.tsx",
  "components/resource-card.tsx",
  "components/resource-list.tsx",
  "components/resource-filters.tsx",
  "components/announcement-banners.tsx",
  "components/ui/badge.tsx",
  "components/member-initials.tsx",
  "components/directory-search-form.tsx",
  "components/directory-privacy-prompt.tsx",
  "components/guide-search-form.tsx",
  "components/guide-article-body.tsx",
  "components/auth-split.tsx",
] as const;

describe("token discipline (012 T006 / FR-030)", () => {
  it.each(PRESENTATION_FILES)("%s carries no literal colour or size", (file) => {
    const source = read(file);
    expect(source, "hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source, "rgb/hsl colour").not.toMatch(/\b(?:rgba?|hsla?)\(/);
    // Arbitrary-value utilities smuggle literals past the theme, e.g. text-[13px].
    expect(source, "arbitrary Tailwind value").not.toMatch(/\b[a-z-]+-\[[^\]]+\]/);
  });

  it.each(PRESENTATION_FILES)("%s renders on the server", (file) => {
    expect(read(file)).not.toContain("use client");
  });

  it.each(PRESENTATION_FILES)("%s uses the shipped 44px spelling", (file) => {
    const source = read(file);
    // 011 settled on `touch`/`tap`; the mockup's `min-h-tap` does not exist here.
    expect(source).not.toMatch(/min-h-tap\b/);
  });
});

describe("shared framing structure (012 T006 / FR-001, FR-002)", () => {
  it("page-header renders one h1 inside a header landmark with an eyebrow", () => {
    const source = read("components/page-header.tsx");
    expect(source.match(/<h1/g) ?? []).toHaveLength(1);
    expect(source).toContain("<header");
    expect(source).toContain("eyebrow");
    expect(source).not.toMatch(/<h2|<h3/);
  });

  it("section-header renders an identified h2 and no competing h1", () => {
    const source = read("components/section-header.tsx");
    expect(source.match(/<h2/g) ?? []).toHaveLength(1);
    expect(source).toMatch(/id=\{/);
    expect(source).not.toContain("<h1");
    expect(source).toContain("eyebrow");
  });

  it("section-header full-list link meets the tap floor and hides its arrow glyph", () => {
    const source = read("components/section-header.tsx");
    expect(source).toMatch(/min-h-touch/);
    expect(source).toContain("arrow-right");
  });

  it("badge is a static label, not an interactive control", () => {
    const source = read("components/ui/badge.tsx");
    expect(source).not.toMatch(/<button|onClick|min-h-touch/);
    expect(source).toMatch(/<span/);
  });
});

describe("page bodies delegate padding to the shell (012 T006 / FR-004)", () => {
  const PAGE_BODIES = [
    "app/(member)/app/page.tsx",
    "app/(member)/app/resources/page.tsx",
    "app/(member)/app/events/page.tsx",
    "app/(member)/app/events/[id]/page.tsx",
    "app/(member)/app/directory/page.tsx",
    "app/(member)/app/directory/[id]/page.tsx",
    "app/(member)/app/profile/privacy/page.tsx",
    "app/(member)/app/profile/sessions/page.tsx",
    "app/(member)/app/guide/page.tsx",
    "app/(member)/app/guide/[slug]/page.tsx",
    "components/announcement-banners.tsx",
    "components/directory-privacy-prompt.tsx",
  ] as const;

  it.each(PAGE_BODIES)("%s adds no outer page padding of its own", (file) => {
    const source = read(file);
    // main in components/app-shell.tsx is the single padding owner.
    expect(source).not.toMatch(/className="[^"]*\bp-6\b/);
  });

  it("app-shell main still owns the gutters", () => {
    const source = read("components/app-shell.tsx");
    expect(source).toContain("px-gutter");
    expect(source).toContain("max-w-content");
  });
});

describe("reserved panel is honest about absent content (012 T006 / FR-021)", () => {
  it("names a region, carries a heading, and offers no link or placeholder row", () => {
    const source = read("components/reserved-panel.tsx");
    expect(source).toContain("<section");
    expect(source).toMatch(/aria-labelledby|aria-label/);
    expect(source).toMatch(/<h2/);
    expect(source).not.toMatch(/<a\s|<Link|href=/);
  });
});
