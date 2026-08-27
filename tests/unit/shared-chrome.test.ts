import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

const forbiddenLiteral = /#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(|\b\d+px\b/;

describe("shared chrome (008 US1)", () => {
  it("button uses token hover/focus and keeps 44px targets and variants", () => {
    const source = read("components/ui/button.tsx");
    expect(source).toContain("hover:bg-primary-hover");
    expect(source).toContain("focus-visible:ring-ring");
    expect(source).toContain("min-h-touch");
    expect(source).toContain("min-w-touch");
    expect(source).toContain("bg-primary");
    expect(source).toContain("bg-secondary");
    expect(source).toContain("bg-destructive");
    expect(source).toContain("variant");
    expect(source).not.toMatch(forbiddenLiteral);
  });

  it("input exports controlClassName and keeps token field chrome", () => {
    const source = read("components/ui/input.tsx");
    expect(source).toMatch(/export const controlClassName/);
    expect(source).toContain("controlClassName");
    expect(source).toContain("min-h-touch");
    expect(source).toContain("border-border-strong");
    expect(source).toContain("focus-visible:ring-ring");
    expect(source).not.toMatch(forbiddenLiteral);
  });

  it("select listbox matches the shared field chrome", () => {
    const source = read("components/ui/select.tsx");
    expect(source).toContain("controlClassName");
    expect(source).toContain('role="listbox"');
    expect(source).toContain("border-border-strong");
    expect(source).toContain("rounded-md");
    expect(source).toContain("bg-background");
    expect(source).not.toMatch(forbiddenLiteral);
  });

  it("label uses token type and color", () => {
    const source = read("components/ui/label.tsx");
    expect(source).toContain("text-sm");
    expect(source).toContain("text-foreground");
    expect(source).not.toMatch(forbiddenLiteral);
  });

  it("card helper exists with token surface classes", () => {
    const relative = "components/ui/card.tsx";
    expect(existsSync(path.join(root, relative)), relative).toBe(true);
    const source = read(relative);
    expect(source).toMatch(/export const cardClassName/);
    expect(source).toContain("bg-card");
    expect(source).toContain("border-border");
    expect(source).toContain("rounded-");
    expect(source).toContain("shadow-");
    expect(source).not.toMatch(forbiddenLiteral);
  });

  it("resource-card applies card tokens on the existing article", () => {
    const source = read("components/resource-card.tsx");
    expect(source).toContain("cardClassName");
    expect(source).toContain("@/components/ui/card");
    expect(source).toContain("<article");
    expect(source).toContain("<Link");
    expect(source).toContain("<img");
    // 012 put the card under a section heading, so the title dropped to h3.
    expect(source).toContain("<h3");
    expect(source).toContain("href={`/app/resources/${resource.id}`}");
  });

  // 012 made the announcement an emphasis surface rather than a neutral card, so
  // it carries the support tokens instead of cardClassName.
  it("announcement banners apply emphasis tokens on the existing article", () => {
    const source = read("components/announcement-banners.tsx");
    expect(source).toContain("border-support");
    expect(source).toContain("bg-support-subtle");
    expect(source).toContain("<article");
    expect(source).toContain("Button");
    expect(source).toContain("cta/primary");
  });

  // 011-app-shell moved the member and admin chrome into AppShell. The link
  // hrefs these two cases used to pin now live in lib/nav/destinations.ts,
  // which is their single source; the token assertions moved with them.
  it("member layout delegates chrome to the shell", () => {
    const source = read("app/(member)/layout.tsx");
    expect(source).toContain("AppShell");
    expect(source).toContain("memberDestinations");
    expect(source).not.toMatch(forbiddenLiteral);
  });

  it("admin layout delegates chrome to the same shell", () => {
    const source = read("app/(admin)/layout.tsx");
    expect(source).toContain("AppShell");
    expect(source).toContain("adminDestinations");
    expect(source).not.toMatch(forbiddenLiteral);
  });

  it("the shell keeps the token chrome the member header used to carry", () => {
    const shell = read("components/app-shell.tsx");
    const sidebar = read("components/shell/desktop-sidebar.tsx");
    expect(shell).toContain("bg-background");
    expect(shell).toContain("px-gutter");
    expect(sidebar).toContain("bg-sidebar");
    expect(sidebar).toContain("border-sidebar-border");
    expect(sidebar).toContain("min-h-touch");
    expect(sidebar).toContain("LogoutButton");
    expect(sidebar).toContain('aria-label="Account"');
  });

  it("the destination module owns the member link set", () => {
    const source = read("lib/nav/destinations.ts");
    for (const href of [
      '"/app"',
      '"/app/resources"',
      '"/app/events"',
      '"/app/directory"',
      '"/app/guide"',
      '"/app/profile/privacy"',
    ]) {
      expect(source, href).toContain(href);
    }
  });
});
