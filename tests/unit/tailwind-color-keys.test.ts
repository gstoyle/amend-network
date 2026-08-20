import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "@/tailwind.config";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * A colour utility whose suffix is not in the theme compiles to nothing, so the
 * element silently inherits. That has now happened three times: the sidebar keys
 * in 011, and --primary-subtle-foreground and --support-subtle-foreground in 012.
 * This walks the utilities the source actually writes and fails on any suffix the
 * theme cannot resolve.
 */
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
  "from",
  "via",
  "to",
] as const;

/** Suffixes these prefixes legitimately take that are not colours. */
const NON_COLOUR_SUFFIXES: Record<string, ReadonlySet<string>> = {
  bg: new Set(["transparent", "current", "inherit", "none", "clip", "cover", "contain", "center"]),
  text: new Set([
    "transparent",
    "current",
    "inherit",
    "eyebrow",
    "xs",
    "sm",
    "base",
    "lg",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "left",
    "center",
    "right",
    "justify",
    "start",
    "end",
    "wrap",
    "nowrap",
    "balance",
    "pretty",
    "ellipsis",
    "clip",
  ]),
  border: new Set([
    "transparent",
    "current",
    "inherit",
    "0",
    "2",
    "4",
    "8",
    "x",
    "y",
    "t",
    "r",
    "b",
    "l",
    "s",
    "e",
    "solid",
    "dashed",
    "dotted",
    "double",
    "hidden",
    "none",
    "collapse",
    "separate",
  ]),
  divide: new Set(["transparent", "current", "inherit", "x", "y", "solid", "dashed", "none"]),
  decoration: new Set([
    "transparent",
    "current",
    "inherit",
    "solid",
    "dashed",
    "dotted",
    "double",
    "wavy",
    "none",
    "auto",
    "from-font",
    "0",
    "1",
    "2",
    "4",
    "8",
    "slice",
    "clone",
  ]),
  ring: new Set(["transparent", "current", "inherit", "0", "1", "2", "4", "8", "inset", "offset"]),
  fill: new Set(["none", "current", "transparent"]),
  stroke: new Set(["none", "current", "transparent", "0", "1", "2"]),
  outline: new Set(["none", "0", "1", "2", "4", "8", "solid", "dashed", "dotted", "offset", "hidden"]),
  shadow: new Set(["xs", "sm", "md", "lg", "xl", "2xl", "bar", "inner", "none"]),
  from: new Set(["transparent", "current", "inherit"]),
  via: new Set(["transparent", "current", "inherit"]),
  to: new Set(["transparent", "current", "inherit"]),
};

function themeColourSuffixes(): Set<string> {
  const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
  const suffixes = new Set<string>();
  for (const [name, value] of Object.entries(colors)) {
    if (typeof value === "string") {
      suffixes.add(name);
      continue;
    }
    for (const key of Object.keys(value as Record<string, unknown>)) {
      suffixes.add(key === "DEFAULT" ? name : `${name}-${key}`);
    }
  }
  return suffixes;
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".tsx")) {
        out.push(full);
      }
    }
  };
  walk(path.join(root, "components"));
  walk(path.join(root, "app"));
  return out;
}

describe("tailwind colour utilities resolve against the theme", () => {
  it("exposes every token the components reference through a colour utility", () => {
    const known = themeColourSuffixes();
    const pattern = new RegExp(
      `\\b(?:(?:hover|focus|focus-visible|active|disabled|group-hover|peer-checked|sm|md|lg|xl|dark|first|last|odd|even|aria-current|data-\\[[^\\]]+\\]):)*(${COLOUR_PREFIXES.join("|")})-([a-z0-9-]+)`,
      "g",
    );
    const unresolved: string[] = [];

    for (const file of sourceFiles()) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(pattern)) {
        const [, prefix] = match;
        // ring-offset-* and outline-offset-* take either a width or a colour.
        const suffix =
          (prefix === "ring" || prefix === "outline") && match[2].startsWith("offset-")
            ? match[2].slice("offset-".length)
            : match[2];
        if (/^\d+$/.test(suffix)) {
          continue;
        }
        if (NON_COLOUR_SUFFIXES[prefix]?.has(suffix)) {
          continue;
        }
        if (known.has(suffix)) {
          continue;
        }
        unresolved.push(`${path.relative(root, file)}: ${prefix}-${suffix}`);
      }
    }

    expect(
      [...new Set(unresolved)].sort(),
      "these utilities compile to nothing; wire the token in tailwind.config.ts or fix the class",
    ).toEqual([]);
  });

  it("never applies an opacity modifier to a colour utility", () => {
    // Every colour in the theme is a bare var(), which cannot absorb an alpha
    // channel, so bg-muted/40 compiles to nothing exactly like a missing key.
    const offenders: string[] = [];
    const pattern = new RegExp(`\\b(?:${COLOUR_PREFIXES.join("|")})-[a-z-]+\\/\\d+`, "g");
    for (const file of sourceFiles()) {
      for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
        offenders.push(`${path.relative(root, file)}: ${match[0]}`);
      }
    }
    expect([...new Set(offenders)].sort()).toEqual([]);
  });

  it("keeps both subtle-foreground pairs wired, since each was missed once", () => {
    const known = themeColourSuffixes();
    expect(known.has("primary-subtle-foreground")).toBe(true);
    expect(known.has("support-subtle-foreground")).toBe(true);
    expect(known.has("sidebar-accent-foreground")).toBe(true);
    expect(known.has("sidebar-primary-foreground")).toBe(true);
  });
});
