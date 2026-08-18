import { describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";

describe("admin_analytics_snapshot is a single SQL function", () => {
  it("exists as one plpgsql function taking exactly p_network_id uuid", async () => {
    const rows = await migrator.$queryRaw<{ proname: string; args: string; nargs: number }[]>`
      SELECT p.proname,
             pg_get_function_identity_arguments(p.oid) AS args,
             p.pronargs AS nargs
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'admin_analytics_snapshot'
        AND n.nspname = 'public'
    `;
    expect(rows).toEqual([
      { proname: "admin_analytics_snapshot", args: "p_network_id uuid", nargs: 1 },
    ]);
  });

  it("REVOKE ALL FROM PUBLIC and GRANT EXECUTE TO amend_app", async () => {
    const rows = await migrator.$queryRaw<
      { amend_execute: boolean; public_execute: boolean }[]
    >`
      SELECT has_function_privilege('amend_app', p.oid, 'EXECUTE') AS amend_execute,
             has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'admin_analytics_snapshot'
        AND n.nspname = 'public'
        AND pg_get_function_identity_arguments(p.oid) = 'p_network_id uuid'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amend_execute).toBe(true);
    expect(rows[0]?.public_execute).toBe(false);
  });
});
