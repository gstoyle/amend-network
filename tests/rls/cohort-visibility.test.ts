import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls, type RlsContext } from "@/lib/db/rls";
import {
  cleanupCohortFixtures,
  createCohort,
  createCohortMember,
  newCohortFixtures,
} from "@/tests/helpers/cohort-fixtures";

/** specs/014-program-cohorts/contracts/rls.md — content visibility and RLS-COH-W-6. */
const fixtures = newCohortFixtures("cohort-vis");

type Table = "resources" | "events" | "announcements" | "forum_categories";
const TABLES: Table[] = ["resources", "events", "announcements", "forum_categories"];

type Row = { id: string; label: string };
const rows: Record<Table, Row[]> = {
  resources: [],
  events: [],
  announcements: [],
  forum_categories: [],
};

let memberA = "";
let memberC = "";
let leadMember = "";
let memberBoth = "";

function literal(visibility: string[]): string {
  return `{${visibility.join(",")}}`;
}

async function insertRow(table: Table, visibility: string[], createdBy: string): Promise<string> {
  const id = randomUUID();
  const title = `${fixtures.marker}-${randomUUID()}`;
  const tokens = literal(visibility);
  switch (table) {
    case "resources":
      await migrator.$executeRaw`
        INSERT INTO resources (
          id, title, preview_text, thumbnail_object_key, source_label, tags,
          file_object_key, file_size_bytes, file_mime_type, visibility, uploaded_by, updated_at
        ) VALUES (
          ${id}::uuid, ${title}, ${"Preview"}, ${"seed/thumb.png"}, ${"Amend"}, ARRAY[]::text[],
          ${"seed/file.pdf"}, ${1024}::bigint, ${"application/pdf"}, ${tokens}::text[],
          ${createdBy}::uuid, CURRENT_TIMESTAMP
        )
      `;
      break;
    case "events":
      await migrator.$executeRaw`
        INSERT INTO events (
          id, title, description, starts_at, ends_at, is_virtual, visibility, created_by, updated_at
        ) VALUES (
          ${id}::uuid, ${title}, ${"Description"}, now() + interval '1 day',
          now() + interval '1 day 1 hour', true, ${tokens}::text[], ${createdBy}::uuid, CURRENT_TIMESTAMP
        )
      `;
      break;
    case "announcements":
      await migrator.$executeRaw`
        INSERT INTO announcements (
          id, headline, body, activates_at, expires_at, visibility, created_by, updated_at
        ) VALUES (
          ${id}::uuid, ${title}, ${"Body"}, now() - interval '1 hour', now() + interval '1 day',
          ${tokens}::text[], ${createdBy}::uuid, CURRENT_TIMESTAMP
        )
      `;
      break;
    case "forum_categories":
      await migrator.$executeRaw`
        INSERT INTO forum_categories (id, name, slug, description, visibility, sort_order)
        VALUES (
          ${id}::uuid, ${`cohort-vis ${id.slice(0, 8)}`}, ${`cohort-vis-${id.slice(0, 8)}`},
          ${"Description"}, ${tokens}::text[], 999
        )
      `;
      break;
    default: {
      const exhaustive: never = table;
      throw new Error(`unknown table ${String(exhaustive)}`);
    }
  }
  return id;
}

async function visibleLabels(table: Table, ctx: RlsContext): Promise<string[]> {
  const ids = rows[table].map((row) => row.id);
  const found = await withRls(ctx, async (tx) => {
    switch (table) {
      case "resources":
        return tx.$queryRaw<{ id: string }[]>`SELECT id::text FROM resources WHERE id = ANY(${ids}::uuid[])`;
      case "events":
        return tx.$queryRaw<{ id: string }[]>`SELECT id::text FROM events WHERE id = ANY(${ids}::uuid[])`;
      case "announcements":
        return tx.$queryRaw<{ id: string }[]>`SELECT id::text FROM announcements WHERE id = ANY(${ids}::uuid[])`;
      case "forum_categories":
        return tx.$queryRaw<{ id: string }[]>`SELECT id::text FROM forum_categories WHERE id = ANY(${ids}::uuid[])`;
      default: {
        const exhaustive: never = table;
        throw new Error(`unknown table ${String(exhaustive)}`);
      }
    }
  });
  const foundIds = new Set(found.map((row) => row.id));
  return rows[table]
    .filter((row) => foundIds.has(row.id))
    .map((row) => row.label)
    .sort();
}

describe("cohort content visibility", () => {
  beforeAll(async () => {
    const cohortA = await createCohort(fixtures, { label: "a", programRole: "pathways" });
    const cohortC = await createCohort(fixtures, { label: "c", programRole: "pathways" });
    const archived = await createCohort(fixtures, {
      label: "archived",
      programRole: "pathways",
      archived: true,
    });
    const leadCohort = await createCohort(fixtures, { label: "lead", programRole: "lead" });
    memberA = await createCohortMember(fixtures, {
      label: "a",
      programRole: "pathways",
      primaryCohortId: cohortA,
      extraCohortIds: [archived],
    });
    memberC = await createCohortMember(fixtures, {
      label: "c",
      programRole: "pathways",
      primaryCohortId: cohortC,
    });
    leadMember = await createCohortMember(fixtures, {
      label: "lead",
      programRole: "lead",
      primaryCohortId: leadCohort,
    });
    memberBoth = await createCohortMember(fixtures, {
      label: "both",
      programRole: "pathways",
      primaryCohortId: cohortC,
      extraCohortIds: [cohortA],
    });

    const cases: Array<[string, string[]]> = [
      ["VIS-1", [`cohort:${cohortA}`]],
      ["VIS-2", [`cohort:${cohortA}`, `cohort:${cohortC}`]],
      ["VIS-3", ["pathways"]],
      ["VIS-4", [`cohort:${archived}`]],
      ["VIS-5", [`cohort:${randomUUID()}`]],
      ["VIS-6", [`cohort:${cohortC}`]],
    ];
    for (const table of TABLES) {
      for (const [label, visibility] of cases) {
        rows[table].push({ id: await insertRow(table, visibility, memberA), label });
      }
    }
  });

  afterAll(async () => {
    for (const table of TABLES) {
      const ids = rows[table].map((row) => row.id);
      switch (table) {
        case "resources":
          await migrator.$executeRaw`DELETE FROM resources WHERE id = ANY(${ids}::uuid[])`;
          break;
        case "events":
          await migrator.$executeRaw`DELETE FROM events WHERE id = ANY(${ids}::uuid[])`;
          break;
        case "announcements":
          await migrator.$executeRaw`DELETE FROM announcements WHERE id = ANY(${ids}::uuid[])`;
          break;
        case "forum_categories":
          await migrator.$executeRaw`DELETE FROM forum_categories WHERE id = ANY(${ids}::uuid[])`;
          break;
        default: {
          const exhaustive: never = table;
          throw new Error(`unknown table ${String(exhaustive)}`);
        }
      }
    }
    await cleanupCohortFixtures(fixtures);
  });

  describe.each(TABLES)("%s", (table) => {
    it("member of cohort A sees A, A+C, the programme, and archived A", async () => {
      expect(
        await visibleLabels(table, {
          userId: memberA,
          programRole: "pathways",
          adminRole: "none",
          status: "active",
        }),
      ).toEqual(["VIS-1", "VIS-2", "VIS-3", "VIS-4"]);
    });

    it("member of cohort C sees C, A+C, and the programme only", async () => {
      expect(
        await visibleLabels(table, {
          userId: memberC,
          programRole: "pathways",
          adminRole: "none",
          status: "active",
        }),
      ).toEqual(["VIS-2", "VIS-3", "VIS-6"]);
    });

    it("member of cohorts A and C sees the union of both", async () => {
      expect(
        await visibleLabels(table, {
          userId: memberBoth,
          programRole: "pathways",
          adminRole: "none",
          status: "active",
        }),
      ).toEqual(["VIS-1", "VIS-2", "VIS-3", "VIS-6"]);
    });

    it("a LEAD member sees none of the GLE cohort rows", async () => {
      expect(
        await visibleLabels(table, {
          userId: leadMember,
          programRole: "lead",
          adminRole: "none",
          status: "active",
        }),
      ).toEqual([]);
    });

    it("a moderator sees every real cohort but not an unknown one", async () => {
      const labels = await visibleLabels(table, {
        userId: leadMember,
        programRole: "none",
        adminRole: "moderator",
        status: "active",
      });
      // Event and forum SELECT already bypass for moderators, so the unknown cohort shows there too.
      const expected =
        table === "events" || table === "forum_categories"
          ? ["VIS-1", "VIS-2", "VIS-3", "VIS-4", "VIS-5", "VIS-6"]
          : ["VIS-1", "VIS-2", "VIS-3", "VIS-4", "VIS-6"];
      expect(labels).toEqual(expected);
    });

    it("an admin sees everything", async () => {
      expect(
        await visibleLabels(table, {
          userId: leadMember,
          programRole: "none",
          adminRole: "admin",
          status: "active",
        }),
      ).toEqual(["VIS-1", "VIS-2", "VIS-3", "VIS-4", "VIS-5", "VIS-6"]);
    });
  });

  it.each(TABLES)("RLS-COH-W-6: %s refuses a malformed cohort token", async (table) => {
    await expect(insertRow(table, ["cohort:bad"], memberA)).rejects.toThrow(/visibility_check/);
  });
});
