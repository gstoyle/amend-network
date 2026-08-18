import { describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";

describe("directory_listing_visible is the single shared SQL fragment", () => {
  it("exists as one sql function taking uuid", async () => {
    const rows = await migrator.$queryRaw<{ proname: string; args: string }[]>`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'directory_listing_visible'
        AND n.nspname = 'public'
    `;
    expect(rows).toEqual([{ proname: "directory_listing_visible", args: "p_user_id uuid" }]);
  });

  it("listings and shown-field SELECT policies call directory_listing_visible instead of pasting staff-OR-same-program predicates", async () => {
    const policies = await migrator.$queryRaw<
      { tablename: string; cmd: string; qual: string | null }[]
    >`
      SELECT tablename, cmd, qual::text AS qual
      FROM pg_policies
      WHERE tablename IN (
        'directory_listings',
        'directory_shown_titles',
        'directory_shown_docs',
        'directory_shown_emails'
      )
        AND cmd = 'SELECT'
    `;
    expect(policies.length).toBe(4);
    for (const policy of policies) {
      expect(policy.qual).toMatch(/directory_listing_visible/i);
      expect(policy.qual).not.toMatch(/app\.admin_role/i);
      expect(policy.qual).not.toMatch(/app\.program_role/i);
    }
  });

  it("AFTER UPDATE OF status on users deletes listing and shown-field rows for any leave-active transition", async () => {
    const triggers = await migrator.$queryRaw<
      { tgname: string; tgdef: string; def: string }[]
    >`
      SELECT t.tgname, pg_get_triggerdef(t.oid) AS tgdef, pg_get_functiondef(p.oid) AS def
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'users'
        AND n.nspname = 'public'
        AND NOT t.tgisinternal
        AND pg_get_triggerdef(t.oid) ILIKE '%UPDATE%status%'
    `;
    expect(triggers.length).toBeGreaterThanOrEqual(1);
    const trigger = triggers[0];
    expect(trigger?.tgdef).toMatch(/AFTER UPDATE OF status/i);
    expect(trigger?.def).toMatch(/directory_listings/i);
    expect(trigger?.def).toMatch(/directory_shown_emails/i);
    expect(trigger?.def).toMatch(/directory_shown_titles/i);
    expect(trigger?.def).toMatch(/directory_shown_docs/i);
    expect(trigger?.def).toMatch(/OLD\.status/i);
    expect(trigger?.def).toMatch(/'active'/i);
    expect(trigger?.def).not.toMatch(/NEW\.status\s*=\s*'deactivated'/i);
  });
});
