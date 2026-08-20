import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

const FORMS = [
  "components/register-form.tsx",
  "components/invite-form.tsx",
  "components/invite-complete-form.tsx",
  "components/resource-form.tsx",
  "components/announcement-form.tsx",
  "components/event-form.tsx",
  "components/pending-queue.tsx",
  "components/resource-filters.tsx",
] as const;

const duplicatedControl =
  /border-input[\s\S]{0,80}bg-background|bg-background[\s\S]{0,80}border-input/;

describe("control class reuse (008 US2)", () => {
  it.each(FORMS)("%s uses shared control chrome and does not duplicate it", (relative) => {
    const source = read(relative);
    expect(
      /import\s*\{[^}]*\bcontrolClassName\b[^}]*\}\s*from\s*"@\/components\/ui\/input"/.test(
        source,
      ) || source.includes('from "@/components/ui/select"'),
    ).toBe(true);
    expect(source).not.toMatch(duplicatedControl);
  });
});
