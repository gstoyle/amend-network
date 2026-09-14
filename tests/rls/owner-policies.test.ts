import { describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";

describe("table-owner policies (Render migrate role cannot BYPASSRLS)", () => {
  it("every FORCE RLS table has a {table}_owner policy", async () => {
    const missing = await migrator.$queryRaw<{ relname: string }[]>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relrowsecurity
        AND c.relforcerowsecurity
        AND NOT EXISTS (
          SELECT 1
          FROM pg_policy pol
          WHERE pol.polrelid = c.oid
            AND pol.polname = c.relname || '_owner'
        )
      ORDER BY c.relname
    `;
    expect(missing).toEqual([]);
  });
});
