import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";

const MARKER = `res-rls-${randomUUID()}`;

function isRlsDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /row-level security policy|permission denied/i.test(message);
}

function isDownloadGuard(error: unknown, kind: "count" | "columns"): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (kind === "count") {
    return /resource_download may only increment download_count by 1/i.test(message);
  }
  return /resource_download may not change columns other than download_count/i.test(message);
}

type ResourceRow = {
  id: string;
  title: string;
  download_count: number;
  deleted_at: Date | null;
};

async function insertResource(input: {
  title: string;
  visibility: string[];
  deletedAt?: Date | null;
  downloadCount?: number;
}): Promise<string> {
  const id = randomUUID();
  const visibilityLiteral = `{${input.visibility.join(",")}}`;
  await migrator.$executeRaw`
    INSERT INTO resources (
      id, title, preview_text, thumbnail_object_key, source_label, tags,
      file_object_key, file_size_bytes, file_mime_type, visibility,
      download_count, uploaded_by, created_at, updated_at, deleted_at
    ) VALUES (
      ${id}::uuid,
      ${input.title},
      ${"Preview for " + input.title},
      ${"seed/thumb.png"},
      ${"Amend"},
      ARRAY[]::text[],
      ${"seed/file.pdf"},
      ${1024}::bigint,
      ${"application/pdf"},
      ${visibilityLiteral}::text[],
      ${input.downloadCount ?? 0},
      ${randomUUID()}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      ${input.deletedAt ?? null}
    )
  `;
  return id;
}

async function getRow(id: string): Promise<ResourceRow | undefined> {
  const rows = await migrator.$queryRaw<ResourceRow[]>`
    SELECT id, title, download_count, deleted_at FROM resources WHERE id = ${id}::uuid
  `;
  return rows[0];
}

async function getCount(id: string): Promise<number> {
  return Number((await getRow(id))?.download_count ?? -1);
}

describe("resources RLS (GUCs only, no requireRole) — contracts/rls-policies.md + RLS-RES-UPD-DL", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await migrator.$executeRaw`DELETE FROM resources WHERE id = ${id}::uuid`;
    }
    createdIds.length = 0;
  });

  it("pathways SELECT sees all_authenticated and pathways, not lead-only", async () => {
    const shared = await insertResource({ title: `${MARKER}-shared`, visibility: ["all_authenticated"] });
    const pathways = await insertResource({ title: `${MARKER}-path`, visibility: ["pathways"] });
    const lead = await insertResource({ title: `${MARKER}-lead`, visibility: ["lead"] });
    createdIds.push(shared, pathways, lead);

    const rows = await withRls(
      { programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$queryRaw<{ title: string }[]>`
          SELECT title FROM resources
          WHERE title LIKE ${MARKER + "%"}
          ORDER BY title
        `,
    );
    const titles = rows.map((row) => row.title);
    expect(titles).toContain(`${MARKER}-shared`);
    expect(titles).toContain(`${MARKER}-path`);
    expect(titles).not.toContain(`${MARKER}-lead`);
  });

  it("lead SELECT does not see pathways-only", async () => {
    const pathways = await insertResource({ title: `${MARKER}-p2`, visibility: ["pathways"] });
    createdIds.push(pathways);
    const rows = await withRls(
      { programRole: "lead", adminRole: "none", status: "active" },
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM resources WHERE id = ${pathways}::uuid
        `,
    );
    expect(rows).toHaveLength(0);
  });

  it("pending SELECT sees no live resources", async () => {
    const shared = await insertResource({ title: `${MARKER}-pend`, visibility: ["all_authenticated"] });
    createdIds.push(shared);
    const rows = await withRls(
      { programRole: "none", adminRole: "none", status: "pending" },
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM resources WHERE id = ${shared}::uuid
        `,
    );
    expect(rows).toHaveLength(0);
  });

  it("moderator SELECT sees live visibilities but not withdrawn", async () => {
    const live = await insertResource({ title: `${MARKER}-mod-live`, visibility: ["lead"] });
    const withdrawn = await insertResource({
      title: `${MARKER}-mod-gone`,
      visibility: ["all_authenticated"],
      deletedAt: new Date(),
    });
    createdIds.push(live, withdrawn);
    const rows = await withRls(
      { programRole: "none", adminRole: "moderator", status: "active" },
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM resources WHERE id IN (${live}::uuid, ${withdrawn}::uuid)
        `,
    );
    expect(rows.map((row) => row.id)).toEqual([live]);
  });

  it("admin SELECT sees withdrawn rows", async () => {
    const withdrawn = await insertResource({
      title: `${MARKER}-admin-gone`,
      visibility: ["pathways"],
      deletedAt: new Date(),
    });
    createdIds.push(withdrawn);
    const rows = await withRls(
      { programRole: "none", adminRole: "admin", status: "active" },
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM resources WHERE id = ${withdrawn}::uuid
        `,
    );
    expect(rows).toHaveLength(1);
  });

  it("pathways INSERT is denied", async () => {
    const id = randomUUID();
    await expect(
      withRls({ programRole: "pathways", adminRole: "none", status: "active" }, (tx) =>
        tx.$executeRaw`
          INSERT INTO resources (
            id, title, preview_text, thumbnail_object_key, source_label, tags,
            file_object_key, file_size_bytes, file_mime_type, visibility,
            download_count, uploaded_by, created_at, updated_at
          ) VALUES (
            ${id}::uuid, ${MARKER + "-ins"}, 'p', 't', 'Amend', ARRAY[]::text[],
            'f', 1, 'application/pdf', '{pathways}', 0, ${id}::uuid,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("admin INSERT is allowed", async () => {
    const id = randomUUID();
    createdIds.push(id);
    await withRls({ programRole: "none", adminRole: "admin", status: "active" }, (tx) =>
      tx.$executeRaw`
        INSERT INTO resources (
          id, title, preview_text, thumbnail_object_key, source_label, tags,
          file_object_key, file_size_bytes, file_mime_type, visibility,
          download_count, uploaded_by, created_at, updated_at
        ) VALUES (
          ${id}::uuid, ${MARKER + "-admin-ins"}, 'p', 't', 'Amend', ARRAY[]::text[],
          'f', 1, 'application/pdf', '{all_authenticated}', 0, ${id}::uuid,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
    );
    const rows = await migrator.$queryRaw<{ id: string }[]>`
      SELECT id FROM resources WHERE id = ${id}::uuid
    `;
    expect(rows).toHaveLength(1);
  });

  it("RLS-RES-UPD-DL: resource_download increment by 1 succeeds on a visible live row", async () => {
    const id = await insertResource({
      title: `${MARKER}-plus1`,
      visibility: ["pathways"],
      downloadCount: 4,
    });
    createdIds.push(id);
    await withRls(
      {
        programRole: "pathways",
        adminRole: "none",
        status: "active",
        authMode: "resource_download",
      },
      (tx) =>
        tx.$executeRaw`
          UPDATE resources SET download_count = download_count + 1 WHERE id = ${id}::uuid
        `,
    );
    expect(await getCount(id)).toBe(5);
  });

  it("RLS-RES-UPD-DL: resource_download increment by 2 is rejected and count is unchanged", async () => {
    const id = await insertResource({
      title: `${MARKER}-plus2`,
      visibility: ["pathways"],
      downloadCount: 4,
    });
    createdIds.push(id);
    await expect(
      withRls(
        {
          programRole: "pathways",
          adminRole: "none",
          status: "active",
          authMode: "resource_download",
        },
        (tx) =>
          tx.$executeRaw`
            UPDATE resources SET download_count = download_count + 2 WHERE id = ${id}::uuid
          `,
      ),
    ).rejects.toSatisfy((error: unknown) => isDownloadGuard(error, "count"));
    expect(await getCount(id)).toBe(4);
  });

  it("RLS-RES-UPD-DL: resource_download increment by 0 is rejected", async () => {
    const id = await insertResource({ title: `${MARKER}-plus0`, visibility: ["pathways"] });
    createdIds.push(id);
    await expect(
      withRls(
        {
          programRole: "pathways",
          adminRole: "none",
          status: "active",
          authMode: "resource_download",
        },
        (tx) =>
          tx.$executeRaw`
            UPDATE resources SET download_count = download_count + 0 WHERE id = ${id}::uuid
          `,
      ),
    ).rejects.toSatisfy((error: unknown) => isDownloadGuard(error, "count"));
    expect(await getCount(id)).toBe(0);
  });

  it("RLS-RES-UPD-DL: resource_download decrement is rejected", async () => {
    const id = await insertResource({
      title: `${MARKER}-minus1`,
      visibility: ["pathways"],
      downloadCount: 3,
    });
    createdIds.push(id);
    await expect(
      withRls(
        {
          programRole: "pathways",
          adminRole: "none",
          status: "active",
          authMode: "resource_download",
        },
        (tx) =>
          tx.$executeRaw`
            UPDATE resources SET download_count = download_count - 1 WHERE id = ${id}::uuid
          `,
      ),
    ).rejects.toSatisfy((error: unknown) => isDownloadGuard(error, "count"));
    expect(await getCount(id)).toBe(3);
  });

  it.each([
    ["title", `title = 'hijacked'`],
    ["preview_text", `preview_text = 'hijacked'`],
    ["tags", `tags = ARRAY['x']`],
    ["file_mime_type", `file_mime_type = 'video/mp4'`],
    ["file_object_key", `file_object_key = 'evil'`],
    ["deleted_at", `deleted_at = CURRENT_TIMESTAMP`],
    ["updated_at", `updated_at = CURRENT_TIMESTAMP + interval '1 day'`],
  ] as const)(
    "RLS-RES-UPD-DL: resource_download cannot change %s even with +1 count",
    async (column, setSql) => {
      const title = `${MARKER}-col-${column}`;
      const id = await insertResource({ title, visibility: ["pathways"] });
      createdIds.push(id);
      const before = await getRow(id);
      await expect(
        withRls(
          {
            programRole: "pathways",
            adminRole: "none",
            status: "active",
            authMode: "resource_download",
          },
          (tx) =>
            tx.$executeRawUnsafe(
              `UPDATE resources SET download_count = download_count + 1, ${setSql} WHERE id = $1::uuid`,
              id,
            ),
        ),
      ).rejects.toSatisfy((error: unknown) => isDownloadGuard(error, "columns"));
      const after = await getRow(id);
      expect(after?.download_count).toBe(0);
      expect(after?.title).toBe(title);
      expect(after?.deleted_at).toBeNull();
      expect(after?.id).toBe(before?.id);
    },
  );

  it("pathways resource_download cannot bump a lead-only row", async () => {
    const id = await insertResource({ title: `${MARKER}-lead-bump`, visibility: ["lead"] });
    createdIds.push(id);
    try {
      const updated = await withRls(
        {
          programRole: "pathways",
          adminRole: "none",
          status: "active",
          authMode: "resource_download",
        },
        (tx) =>
          tx.$executeRaw`
            UPDATE resources SET download_count = download_count + 1 WHERE id = ${id}::uuid
          `,
      );
      expect(updated).toBe(0);
    } catch (error: unknown) {
      expect(isRlsDenied(error)).toBe(true);
    }
    expect(await getCount(id)).toBe(0);
  });
});
