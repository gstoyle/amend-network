import { describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";

describe("event_visible_core is the single shared SQL fragment", () => {
  it("exists as one sql function taking uuid", async () => {
    const rows = await migrator.$queryRaw<{ proname: string; args: string }[]>`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'event_visible_core'
        AND n.nspname = 'public'
    `;
    expect(rows).toEqual([{ proname: "event_visible_core", args: "p_event_id uuid" }]);
  });

  it("events SELECT / event_rsvps INSERT-UPDATE / event_join_links SELECT call the functions instead of pasting core predicates", async () => {
    const policies = await migrator.$queryRaw<
      { tablename: string; policyname: string; cmd: string; qual: string | null; with_check: string | null }[]
    >`
      SELECT tablename, policyname, cmd, qual::text AS qual, with_check::text AS with_check
      FROM pg_policies
      WHERE tablename IN ('events', 'event_rsvps', 'event_join_links')
    `;

    const eventsSelect = policies.find(
      (row) => row.tablename === "events" && row.cmd === "SELECT",
    );
    expect(eventsSelect?.qual).toMatch(/event_visible_core/i);
    expect(eventsSelect?.qual).not.toMatch(/app_role_tokens\(\)/i);
    expect(eventsSelect?.qual).not.toMatch(/cancelled_at IS NULL/i);

    const eventsInsert = policies.find(
      (row) => row.tablename === "events" && row.cmd === "INSERT",
    );
    expect(eventsInsert?.with_check).toMatch(/moderator/i);

    const rsvpInsert = policies.find(
      (row) => row.tablename === "event_rsvps" && row.cmd === "INSERT",
    );
    expect(rsvpInsert?.with_check).toMatch(/event_visible_core/i);
    expect(rsvpInsert?.with_check).not.toMatch(/app_role_tokens\(\)/i);

    const rsvpUpdate = policies.find(
      (row) => row.tablename === "event_rsvps" && row.cmd === "UPDATE",
    );
    expect(rsvpUpdate?.with_check).toMatch(/event_visible_core/i);
    expect(rsvpUpdate?.qual).toMatch(/event_visible_core/i);
    expect(rsvpUpdate?.with_check).not.toMatch(/app_role_tokens\(\)/i);

    const joinSelect = policies.find(
      (row) => row.tablename === "event_join_links" && row.cmd === "SELECT",
    );
    expect(joinSelect?.qual).toMatch(/event_join_revealed/i);
    expect(joinSelect?.qual).not.toMatch(/app_role_tokens\(\)/i);
  });

  it("event_join_revealed and event_promote_oldest_waitlist call event_visible_core; promote has pronargs = 1", async () => {
    const defs = await migrator.$queryRaw<{ proname: string; def: string; pronargs: number }[]>`
      SELECT p.proname, pg_get_functiondef(p.oid) AS def, p.pronargs
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname IN ('event_join_revealed', 'event_promote_oldest_waitlist')
        AND n.nspname = 'public'
    `;
    const revealed = defs.find((row) => row.proname === "event_join_revealed");
    expect(revealed?.def).toMatch(/event_visible_core/i);
    expect(revealed?.def).not.toMatch(/app_role_tokens\(\)/i);

    const promote = defs.find((row) => row.proname === "event_promote_oldest_waitlist");
    expect(promote?.def).toMatch(/event_visible_core/i);
    expect(promote?.pronargs).toBe(1);
  });
});
