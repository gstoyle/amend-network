import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tokensPath = path.join(root, "app/tokens.css");
const themePath = path.join(root, "tailwind.config.ts");
const uiDir = path.join(root, "components/ui");

const REQUIRED_TOKENS = [
  "--stone-50",
  "--stone-100",
  "--stone-200",
  "--stone-300",
  "--stone-400",
  "--stone-500",
  "--stone-600",
  "--stone-700",
  "--stone-800",
  "--stone-900",
  "--evergreen-50",
  "--evergreen-100",
  "--evergreen-300",
  "--evergreen-600",
  "--evergreen-700",
  "--evergreen-800",
  "--clay-50",
  "--clay-100",
  "--clay-600",
  "--clay-700",
  "--status-success",
  "--status-warning",
  "--status-danger",
  "--status-info",
  "--white",
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-hover",
  "--primary-foreground",
  "--primary-subtle",
  "--primary-subtle-foreground",
  "--support",
  "--support-foreground",
  "--support-subtle",
  "--support-subtle-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--success",
  "--success-subtle",
  "--warning",
  "--warning-subtle",
  "--info",
  "--info-subtle",
  "--border",
  "--border-strong",
  "--input",
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--font-body",
  "--font-heading",
  "--font-mono",
  "--text-eyebrow",
  "--leading-eyebrow",
  "--tracking-eyebrow",
  "--text-xs",
  "--text-sm",
  "--text-base",
  "--text-lg",
  "--text-xl",
  "--text-2xl",
  "--text-3xl",
  "--text-4xl",
  "--leading-xs",
  "--leading-sm",
  "--leading-base",
  "--leading-lg",
  "--leading-xl",
  "--leading-2xl",
  "--leading-3xl",
  "--leading-4xl",
  "--weight-normal",
  "--weight-medium",
  "--weight-semibold",
  "--weight-bold",
  "--space-px",
  "--space-0-5",
  "--space-1",
  "--space-1-5",
  "--space-2",
  "--space-2-5",
  "--space-3",
  "--space-3-5",
  "--space-4",
  "--space-5",
  "--space-6",
  "--space-7",
  "--space-8",
  "--space-9",
  "--space-10",
  "--space-11",
  "--space-12",
  "--space-14",
  "--space-16",
  "--space-20",
  "--space-24",
  "--tap-target",
  "--gutter",
  "--gutter-lg",
  "--content-max",
  "--radius-xs",
  "--radius-sm",
  "--radius",
  "--radius-md",
  "--radius-lg",
  "--radius-xl",
  "--radius-full",
  "--shadow-none",
  "--shadow-xs",
  "--shadow-sm",
  "--shadow-md",
  "--shadow-lg",
  "--shadow-bar",
  "--focus-width",
  "--focus-offset",
  "--duration-fast",
  "--duration-base",
  "--ease-standard",
] as const;

const THEME_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-hover",
  "--primary-foreground",
  "--primary-subtle",
  "--support",
  "--secondary",
  "--muted",
  "--accent",
  "--destructive",
  "--success",
  "--warning",
  "--info",
  "--border",
  "--border-strong",
  "--input",
  "--ring",
  "--sidebar",
  "--font-body",
  "--font-heading",
  "--font-mono",
  "--tap-target",
  "--text-sm",
  "--radius-md",
  "--shadow-sm",
  "--duration-fast",
] as const;

const CONTRAST_PAIRS: ReadonlyArray<{
  fg: string;
  bg: string;
  min: number;
}> = [
  { fg: "--foreground", bg: "--background", min: 4.5 },
  { fg: "--muted-foreground", bg: "--background", min: 4.5 },
  { fg: "--primary-foreground", bg: "--primary", min: 4.5 },
  { fg: "--secondary-foreground", bg: "--secondary", min: 4.5 },
  { fg: "--destructive-foreground", bg: "--destructive", min: 4.5 },
  { fg: "--card-foreground", bg: "--card", min: 4.5 },
  { fg: "--ring", bg: "--background", min: 3 },
  { fg: "--border-strong", bg: "--background", min: 3 },
];

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function sliceBalanced(source: string, openBraceIndex: number): string {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBraceIndex + 1, i);
      }
    }
  }
  return source.slice(openBraceIndex + 1);
}

function parseDeclarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  for (const match of block.matchAll(re)) {
    out[match[1]] = match[2].trim();
  }
  return out;
}

function parseTokenFile(css: string): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const stripped = stripComments(css);
  const rootIdx = stripped.search(/:root(?:\.dark)?\s*\{/);
  expect(rootIdx, "tokens.css must contain a :root block").toBeGreaterThanOrEqual(0);
  const light = parseDeclarations(sliceBalanced(stripped, stripped.indexOf("{", rootIdx)));

  const mediaIdx = stripped.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/);
  const classIdx = stripped.search(/:root\.dark\s*\{/);
  let overrides: Record<string, string> = {};
  if (mediaIdx >= 0) {
    const mediaBody = sliceBalanced(stripped, stripped.indexOf("{", mediaIdx));
    overrides = parseDeclarations(mediaBody);
  } else if (classIdx >= 0) {
    overrides = parseDeclarations(sliceBalanced(stripped, stripped.indexOf("{", classIdx)));
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
  if (hexMatch) {
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
  const rgbMatch = value.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }
  throw new Error(`Not a resolvable color: ${value}`);
}

function normalizeHex(value: string): string {
  const { r, g, b } = parseHexRgb(value);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(value: string): number {
  const { r, g, b } = parseHexRgb(value);
  return (
    0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
  );
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("design tokens (008 T002)", () => {
  it("(1) app/tokens.css defines every manifest custom property on :root", () => {
    expect(existsSync(tokensPath), "app/tokens.css must exist").toBe(true);
    const css = readFileSync(tokensPath, "utf8");
    expect(css).not.toMatch(/fonts\.googleapis\.com/);
    expect(css).not.toMatch(/@import[^;]*mockup/);
    const { light } = parseTokenFile(css);
    for (const name of REQUIRED_TOKENS) {
      expect(light, `missing ${name}`).toHaveProperty(name);
    }
    expect(light["--tap-target"]).toBe("2.75rem");
  });

  it("(2) light --primary is evergreen-700 and --background is stone-100", () => {
    const { light } = parseTokenFile(readFileSync(tokensPath, "utf8"));
    expect(normalizeHex(resolveToken("--primary", light))).toBe("#1f4d3f");
    expect(normalizeHex(resolveToken("--background", light))).toBe("#f4f1eb");
  });

  it("(3) contrast pairs meet WCAG AA in light and dark", () => {
    const { light, dark } = parseTokenFile(readFileSync(tokensPath, "utf8"));
    for (const mode of [light, dark]) {
      for (const pair of CONTRAST_PAIRS) {
        const ratio = contrastRatio(resolveToken(pair.fg, mode), resolveToken(pair.bg, mode));
        expect(
          ratio,
          `${pair.fg} on ${pair.bg} was ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(pair.min);
      }
    }
  });

  it("(4) tailwind.config.ts maps colors to var(--*) and does not wrap hsl()", () => {
    const source = readFileSync(themePath, "utf8");
    expect(source).not.toMatch(/hsl\(\s*var\(/);
    expect(source).not.toMatch(/calc\(\s*var\(--radius\)/);
    for (const name of THEME_VARS) {
      expect(source, `theme missing ${name}`).toContain(`var(${name})`);
    }
  });

  it("(5) components/ui/*.tsx contain no hex / rgb( / hsl( literals", () => {
    const files = readdirSync(uiDir).filter((name) => name.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    const forbidden = /#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(/;
    for (const name of files) {
      const source = readFileSync(path.join(uiDir, name), "utf8");
      expect(source, name).not.toMatch(forbidden);
    }
  });
});
