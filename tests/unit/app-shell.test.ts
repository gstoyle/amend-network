import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

const forbiddenLiteral = /#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(|\b\d+px\b/;

const CHROME_FILES = [
  "components/app-shell.tsx",
  "components/shell/desktop-sidebar.tsx",
  "components/shell/desktop-account-menu.tsx",
  "components/shell/mobile-top-bar.tsx",
  "components/shell/bottom-tab-bar.tsx",
  "components/ui/icon.tsx",
];

describe("shell chrome exists (T004)", () => {
  for (const relative of CHROME_FILES) {
    it(`${relative} is present`, () => {
      expect(existsSync(path.join(root, relative)), relative).toBe(true);
    });
  }
});

describe("shell chrome is token-driven (T004 / FR-017)", () => {
  for (const relative of CHROME_FILES) {
    it(`${relative} hard-codes no colour, radius, or spacing value`, () => {
      const source = read(relative).replace(/env\(safe-area-inset-bottom\)/g, "");
      expect(source).not.toMatch(forbiddenLiteral);
    });
  }

  it("uses the shipped tap-target spelling, never the mockup's", () => {
    for (const relative of CHROME_FILES) {
      const source = read(relative);
      expect(source, relative).not.toMatch(/\b(min-h-tap|min-w-tap|h-tap|w-tap)\b/);
    }
    expect(read("components/shell/desktop-sidebar.tsx")).toContain("min-h-touch");
    expect(read("components/shell/bottom-tab-bar.tsx")).toContain("min-h-touch");
    expect(read("components/shell/mobile-top-bar.tsx")).toContain("min-h-touch");
  });

  it("exposes the two sidebar theme keys 008 defined but left unwired", () => {
    const config = read("tailwind.config.ts");
    expect(config).toContain("var(--sidebar-accent-foreground)");
    expect(config).toContain("var(--sidebar-primary-foreground)");
    expect(read("components/shell/desktop-sidebar.tsx")).toContain(
      "text-sidebar-accent-foreground",
    );
  });
});

describe("shell chrome navigation still works without JS (T004 / FR-020, FR-021, amended 2026-08-29)", () => {
  // app-shell.tsx and icon.tsx are pure composition/presentation and stay server-only.
  // The nav components need usePathname so active-state highlighting reflects the
  // current route on client navigation: a shared layout's x-pathname header does not
  // update on navigation between sibling routes (research.md §4 amendment).
  for (const relative of [
    "components/app-shell.tsx",
    "components/shell/desktop-account-menu.tsx",
    "components/ui/icon.tsx",
  ]) {
    it(`${relative} is a server component`, () => {
      expect(read(relative), relative).not.toContain("use client");
    });
  }

  it("nav components use usePathname only to compute the active entry, not to gate navigation", () => {
    for (const relative of [
      "components/shell/desktop-sidebar.tsx",
      "components/shell/mobile-top-bar.tsx",
      "components/shell/bottom-tab-bar.tsx",
    ]) {
      const source = read(relative);
      expect(source, relative).toContain("use client");
      expect(source, relative).toContain("usePathname");
      expect(source, relative).not.toMatch(/\bonClick\b|\buseState\b/);
    }
  });

  it("primary destinations render as real anchor-backed Links, not client-only handlers", () => {
    for (const relative of [
      "components/shell/desktop-sidebar.tsx",
      "components/shell/bottom-tab-bar.tsx",
    ]) {
      const source = read(relative);
      expect(source, relative).toContain("<Link");
      expect(source, relative).toContain("href={destination.href}");
    }
  });
});

describe("shell chrome structure (T004 / FR-011, FR-012)", () => {
  it("app-shell provides a skip link ahead of navigation and one main landmark", () => {
    const source = read("components/app-shell.tsx");
    const skipIndex = source.indexOf("#main-content");
    const sidebarIndex = source.indexOf("<DesktopSidebar");
    expect(skipIndex).toBeGreaterThan(-1);
    expect(sidebarIndex).toBeGreaterThan(-1);
    expect(skipIndex).toBeLessThan(sidebarIndex);
    expect(source).toContain('id="main-content"');
    expect(source.match(/<main/g) ?? []).toHaveLength(1);
  });

  it("app-shell introduces no h1 of its own", () => {
    for (const relative of CHROME_FILES) {
      expect(read(relative), relative).not.toContain("<h1");
    }
  });

  it("exactly one navigation pattern is visible at a time", () => {
    expect(read("components/app-shell.tsx")).toContain("lg:");
    expect(read("components/shell/desktop-sidebar.tsx")).toContain("lg:flex");
    expect(read("components/shell/bottom-tab-bar.tsx")).toContain("lg:hidden");
    expect(read("components/shell/mobile-top-bar.tsx")).toContain("lg:hidden");
  });

  it("bottom bar clears a reserved bottom edge and content clears the bar", () => {
    expect(read("components/shell/bottom-tab-bar.tsx")).toContain(
      "env(safe-area-inset-bottom)",
    );
    expect(read("components/app-shell.tsx")).toMatch(/\bpb-\d+\b/);
  });

  it("icons are decorative and never replace a label", () => {
    const icon = read("components/ui/icon.tsx");
    expect(icon).toContain('aria-hidden="true"');
    expect(icon).toContain('focusable="false"');
    expect(icon).toContain("currentColor");
  });
});

describe("chrome carries no PII beyond name and program role (T004 / FR-018)", () => {
  for (const relative of CHROME_FILES) {
    it(`${relative} references no email, title, or DOC affiliation`, () => {
      const source = read(relative);
      expect(source, relative).not.toMatch(/\bemail\b/i);
      expect(source, relative).not.toMatch(/\bdocLabel\b|\bdocAffiliation\b/i);
    });
  }
});
