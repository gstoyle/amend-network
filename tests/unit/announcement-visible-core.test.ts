import { describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";

describe("announcement_visible_core is the single shared SQL fragment", () => {
  it("exists as one sql function taking uuid", async () => {
    const rows = await migrator.$queryRaw<{ proname: string; args: string }[]>`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'announcement_visible_core'
        AND n.nspname = 'public'
    `;
    expect(rows).toEqual([{ proname: "announcement_visible_core", args: "p_announcement_id uuid" }]);
  });

  it("announcements SELECT, dismissals INSERT, and impressions INSERT call the function instead of pasting core predicates", async () => {
    const policies = await migrator.$queryRaw<
      { tablename: string; policyname: string; qual: string | null; with_check: string | null }[]
    >`
      SELECT tablename, policyname, qual::text AS qual, with_check::text AS with_check
      FROM pg_policies
      WHERE tablename IN ('announcements', 'announcement_dismissals', 'announcement_impressions')
    `;

    const selectPolicy = policies.find(
      (row) => row.tablename === "announcements" && /select/i.test(row.policyname),
    );
    expect(selectPolicy?.qual).toMatch(/announcement_visible_core/i);
    expect(selectPolicy?.qual).not.toMatch(/app_role_tokens\(\)/i);
    expect(selectPolicy?.qual).toMatch(/announcement_dismissals/i);

    const dismissInsert = policies.find(
      (row) => row.tablename === "announcement_dismissals" && /insert/i.test(row.policyname),
    );
    expect(dismissInsert?.with_check).toMatch(/announcement_visible_core/i);
    expect(dismissInsert?.with_check).toMatch(/dismissible/i);
    expect(dismissInsert?.with_check).not.toMatch(/NOT EXISTS/i);
    expect(dismissInsert?.with_check).not.toMatch(/app_role_tokens\(\)/i);

    const impressInsert = policies.find(
      (row) => row.tablename === "announcement_impressions" && /insert/i.test(row.policyname),
    );
    expect(impressInsert?.with_check).toMatch(/announcement_visible_core/i);
    expect(impressInsert?.with_check).toMatch(/announcement_dismissals/i);
    expect(impressInsert?.with_check).not.toMatch(/app_role_tokens\(\)/i);
  });

  it("announcement_dismissible calls announcement_visible_core instead of pasting core predicates", async () => {
    const rows = await migrator.$queryRaw<{ def: string }[]>`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'announcement_dismissible'
        AND n.nspname = 'public'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.def).toMatch(/announcement_visible_core/i);
    expect(rows[0]?.def).toMatch(/dismissible/i);
    expect(rows[0]?.def).not.toMatch(/app_role_tokens\(\)/i);
  });
});
