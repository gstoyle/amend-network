import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const JOB_IMPORT = /runRetentionJob/;
const AUTH_MODE_LITERAL = /authMode:\s*["']retention["']/;

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("retention job has no HTTP surface (T018)", () => {
  it("app/ contains no route or page that imports runRetentionJob", () => {
    const appDir = join(ROOT, "app");
    const hits = walkTsFiles(appDir).filter((file) => JOB_IMPORT.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });

  it("scripts/run-retention.ts invokes runRetentionJob without an authMode literal", () => {
    const script = join(ROOT, "scripts", "run-retention.ts");
    expect(existsSync(script)).toBe(true);
    const source = readFileSync(script, "utf8");
    expect(source).toMatch(/runRetentionJob\s*\(/);
    expect(source).not.toMatch(AUTH_MODE_LITERAL);
  });
});
