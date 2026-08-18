import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseBlock(css: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stripComments(css).match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) {
    throw new Error(`Missing ${selector} block`);
  }
  const map: Record<string, string> = {};
  for (const line of match[1].split(";")) {
    const trimmed = line.trim();
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      continue;
    }
    const name = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (name.startsWith("--")) {
      map[name] = value;
    }
  }
  return map;
}

function parseTokenFile(css: string): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const light = parseBlock(css, ":root");
  const darkBlock = stripComments(css).match(
    /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root\s*\{([\s\S]*?)\}/,
  );
  const overrides: Record<string, string> = {};
  if (darkBlock) {
    for (const line of darkBlock[1].split(";")) {
      const trimmed = line.trim();
      const colon = trimmed.indexOf(":");
      if (colon === -1) {
        continue;
      }
      const name = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      if (name.startsWith("--")) {
        overrides[name] = value;
      }
    }
  }
  return { light, dark: { ...light, ...overrides } };
}

function resolveToken(
  name: string,
  map: Record<string, string>,
  seen: Set<string> = new Set(),
): string {
  const raw = map[name];
  if (raw === undefined) {
    throw new Error(`Missing token ${name}`);
  }
  const varMatch = raw.match(/^var\((--[\w-]+)\)\s*$/);
  if (!varMatch) {
    return raw;
  }
  if (seen.has(name)) {
    throw new Error(`Cycle resolving ${name}`);
  }
  seen.add(name);
  return resolveToken(varMatch[1], map, seen);
}

function parseHexRgb(value: string): { r: number; g: number; b: number } {
  const hexMatch = value.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hexMatch) {
    throw new Error(`Not a hex color: ${value}`);
  }
  let hex = hexMatch[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(value: string): number {
  const { r, g, b } = parseHexRgb(value);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const CONTRAST_PAIRS: ReadonlyArray<{ fg: string; bg: string; min: number; kind: string }> = [
  { fg: "--foreground", bg: "--background", min: 4.5, kind: "body" },
  { fg: "--muted-foreground", bg: "--background", min: 4.5, kind: "body" },
  { fg: "--primary-foreground", bg: "--primary", min: 4.5, kind: "body" },
  { fg: "--secondary-foreground", bg: "--secondary", min: 4.5, kind: "body" },
  { fg: "--destructive-foreground", bg: "--destructive", min: 4.5, kind: "body" },
  { fg: "--card-foreground", bg: "--card", min: 4.5, kind: "body" },
  { fg: "--ring", bg: "--background", min: 3, kind: "interactive" },
  { fg: "--border-strong", bg: "--background", min: 3, kind: "interactive" },
];

describe("a11y lock (008 US3)", () => {
  it("button, input, initials, and member nav keep 44px token targets", () => {
    const tokens = read("app/tokens.css");
    expect(tokens).toMatch(/--tap-target:\s*2\.75rem/);
    const theme = read("tailwind.config.ts");
    expect(theme).toContain('touch: "var(--tap-target)"');

    const button = read("components/ui/button.tsx");
    expect(button).toContain("min-h-touch");
    expect(button).toContain("min-w-touch");

    const input = read("components/ui/input.tsx");
    expect(input).toContain("min-h-touch");

    const initials = read("components/member-initials.tsx");
    expect(initials).toContain("min-h-touch");
    expect(initials).toContain("min-w-touch");

    const member = read("app/(member)/layout.tsx");
    expect(member).toContain("min-h-touch");
    expect(member).toContain('href="/app"');
    expect(member).toContain('href="/app/resources"');
    expect(member).toContain('href="/app/events"');
    expect(member).toContain('href="/app/directory"');
    expect(member).toContain('href="/app/profile/privacy"');
  });

  it("globals.css keeps prefers-reduced-motion rules", () => {
    const source = read("app/globals.css");
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    expect(source).toContain("animation-duration: 0.01ms !important");
    expect(source).toContain("transition-duration: 0.01ms !important");
  });

  it("globals.css and tailwind.config.ts have no hsl(var()) placeholders", () => {
    expect(read("app/globals.css")).not.toMatch(/hsl\(\s*var\(/);
    expect(read("tailwind.config.ts")).not.toMatch(/hsl\(\s*var\(/);
  });

  it("mockup token contrast pairs still meet 4.5:1 body and 3:1 interactive floors", () => {
    const { light, dark } = parseTokenFile(read("app/tokens.css"));
    const report: Record<string, string> = {};
    for (const [label, mode] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      for (const pair of CONTRAST_PAIRS) {
        const ratio = contrastRatio(resolveToken(pair.fg, mode), resolveToken(pair.bg, mode));
        const key = `${label} ${pair.fg} on ${pair.bg} (${pair.kind})`;
        report[key] = `${ratio.toFixed(2)}:1`;
        expect(ratio, `${key} was ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(pair.min);
      }
    }
    console.log(`008 US3 contrast\n${JSON.stringify(report, null, 2)}`);
  });
});
