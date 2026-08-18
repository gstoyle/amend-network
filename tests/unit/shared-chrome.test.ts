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
    expect(source).toContain("border-input");
    expect(source).toContain("focus-visible:ring-ring");
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
    expect(source).toContain("<h2");
    expect(source).toContain("href={`/app/resources/${resource.id}`}");
  });

  it("announcement banners apply card tokens on the existing article", () => {
    const source = read("components/announcement-banners.tsx");
    expect(source).toContain("cardClassName");
    expect(source).toContain("@/components/ui/card");
    expect(source).toContain("<article");
    expect(source).toContain("Button");
    expect(source).toContain("cta/primary");
  });

  it("member layout uses token chrome and keeps the same nav links", () => {
    const source = read("app/(member)/layout.tsx");
    expect(source).toContain("bg-background");
    expect(source).toContain("bg-sidebar");
    expect(source).toContain("border-border");
    expect(source).toContain("px-gutter");
    expect(source).toContain('href="/app"');
    expect(source).toContain('href="/app/resources"');
    expect(source).toContain('href="/app/events"');
    expect(source).toContain('href="/app/directory"');
    expect(source).toContain('href="/app/profile/privacy"');
    expect(source).toContain("min-h-touch");
    expect(source).not.toMatch(/PortalShell|BottomTabBar|DesktopSidebar/);
    expect(source).not.toMatch(forbiddenLiteral);
  });

  it("admin layout uses the same token chrome set", () => {
    const source = read("app/(admin)/layout.tsx");
    expect(source).toContain("bg-background");
    expect(source).toContain("bg-sidebar");
    expect(source).toContain("border-border");
    expect(source).toContain("px-gutter");
    expect(source).toContain('aria-label="Account"');
    expect(source).toContain("LogoutButton");
    expect(source).not.toMatch(/PortalShell|BottomTabBar|DesktopSidebar/);
    expect(source).not.toMatch(forbiddenLiteral);
  });
});
