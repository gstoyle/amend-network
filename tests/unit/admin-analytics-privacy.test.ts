import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PII_METADATA_KEYS } from "@/lib/audit/write";
import { EXPORT_METADATA_KEYS } from "@/lib/audit/export";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

const DASHBOARD_SOURCES = [
  "lib/admin-analytics/load.ts",
  "app/(admin)/admin/page.tsx",
  "app/(admin)/admin/analytics/page.tsx",
  "components/admin-kpi-cards.tsx",
  "components/admin-funnel.tsx",
  "components/admin-leaderboards.tsx",
];

describe("admin analytics privacy (T029 / FR-022)", () => {
  it("dashboard load and screens do not call track()", () => {
    for (const relative of DASHBOARD_SOURCES) {
      const source = read(relative);
      expect(source, relative).not.toMatch(/from\s+["']@\/lib\/analytics\/track["']/);
      expect(source, relative).not.toMatch(/\btrack\s*\(/);
    }
  });

  it("export metadata keys stay off the PII denylist", () => {
    expect([...EXPORT_METADATA_KEYS]).toEqual([
      "rowCount",
      "hasActor",
      "hasAction",
      "hasFrom",
      "hasTo",
      "hasSeverity",
    ]);
    for (const key of EXPORT_METADATA_KEYS) {
      expect(PII_METADATA_KEYS.has(key.toLowerCase()), key).toBe(false);
    }
    expect(PII_METADATA_KEYS.has("email")).toBe(true);
    expect(PII_METADATA_KEYS.has("doc_affiliation")).toBe(true);
  });
});
