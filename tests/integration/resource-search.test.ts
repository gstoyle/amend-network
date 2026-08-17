import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { listResources } from "@/lib/resources/list";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `search-${randomUUID()}`;

async function insertLive(input: {
  title: string;
  previewText?: string;
  visibility: string[];
  tags?: string[];
  sourceLabel?: string;
  downloadCount?: number;
  createdAt?: Date;
  deletedAt?: Date | null;
}): Promise<string> {
  const row = await migrator.resource.create({
    data: {
      id: randomUUID(),
      title: input.title,
      previewText: input.previewText ?? `Preview for ${input.title}`,
      thumbnailObjectKey: `seed/${randomUUID()}/thumb.png`,
      sourceLabel: input.sourceLabel ?? "Amend",
      tags: input.tags ?? [],
      fileObjectKey: `seed/${randomUUID()}/file.pdf`,
      fileSizeBytes: BigInt(1024),
      fileMimeType: "application/pdf",
      visibility: input.visibility,
      downloadCount: input.downloadCount ?? 0,
      uploadedBy: randomUUID(),
      createdAt: input.createdAt,
      deletedAt: input.deletedAt ?? null,
    },
  });
  return row.id;
}

function ours(rows: { title: string }[]): string[] {
  return rows.filter((row) => row.title.startsWith(MARKER)).map((row) => row.title);
}

describe("member resource search (US5 / FR-015)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    if (createdIds.length > 0) {
      await migrator.resource.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  async function seedCatalog() {
    const alpha = await insertLive({
      title: `${MARKER}-Alpha handbook`,
      previewText: "reentry guide",
      visibility: ["pathways"],
      tags: ["handbook"],
      sourceLabel: "Amend",
      downloadCount: 5,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const beta = await insertLive({
      title: `${MARKER}-Beta 100% checklist`,
      previewText: "forms packet",
      visibility: ["all_authenticated"],
      tags: ["forms"],
      sourceLabel: "Partner Org",
      downloadCount: 20,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    const gamma = await insertLive({
      title: `${MARKER}-Gamma workshop`,
      previewText: "token a_b in preview",
      visibility: ["pathways", "lead"],
      tags: ["handbook", "workshop"],
      sourceLabel: "External",
      downloadCount: 1,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    const leadOnly = await insertLive({
      title: `${MARKER}-Alpha handbook LEAD`,
      previewText: "reentry guide",
      visibility: ["lead"],
      tags: ["handbook"],
      sourceLabel: "Amend",
      downloadCount: 99,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    const withdrawn = await insertLive({
      title: `${MARKER}-Alpha withdrawn`,
      previewText: "reentry guide",
      visibility: ["pathways"],
      tags: ["handbook"],
      sourceLabel: "Amend",
      deletedAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    createdIds.push(alpha, beta, gamma, leadOnly, withdrawn);
    return { alpha, beta, gamma, leadOnly, withdrawn };
  }

  it("keyword matches title or preview and escapes ILIKE wildcards", async () => {
    await seedCatalog();
    const wild = await insertLive({
      title: `${MARKER}-wildcard axb`,
      previewText: "not the underscore token",
      visibility: ["pathways"],
    });
    createdIds.push(wild);

    const byTitle = ours(await listResources(claimsFor("pathways"), { q: "handbook" }));
    expect(byTitle).toEqual([`${MARKER}-Alpha handbook`]);

    const byPreview = ours(await listResources(claimsFor("pathways"), { q: "forms packet" }));
    expect(byPreview).toEqual([`${MARKER}-Beta 100% checklist`]);

    const literalPercent = ours(await listResources(claimsFor("pathways"), { q: "100%" }));
    expect(literalPercent).toEqual([`${MARKER}-Beta 100% checklist`]);

    const literalUnderscore = ours(await listResources(claimsFor("pathways"), { q: "a_b" }));
    expect(literalUnderscore).toEqual([`${MARKER}-Gamma workshop`]);
    expect(literalUnderscore).not.toContain(`${MARKER}-wildcard axb`);
  });

  it("tag and source filters are conjunctive and stay empty when nothing matches", async () => {
    await seedCatalog();
    const handbook = ours(
      await listResources(claimsFor("pathways"), { tags: ["handbook"] }),
    );
    expect(handbook.sort()).toEqual(
      [`${MARKER}-Alpha handbook`, `${MARKER}-Gamma workshop`].sort(),
    );

    const handbookExternal = ours(
      await listResources(claimsFor("pathways"), {
        tags: ["handbook"],
        source: "External",
      }),
    );
    expect(handbookExternal).toEqual([`${MARKER}-Gamma workshop`]);

    const empty = ours(
      await listResources(claimsFor("pathways"), {
        q: "handbook",
        source: "Partner Org",
      }),
    );
    expect(empty).toEqual([]);
  });

  it("sorts visible rows by newest, downloads, and title", async () => {
    await seedCatalog();
    const newest = ours(await listResources(claimsFor("pathways"), { sort: "newest" }));
    expect(newest).toEqual([
      `${MARKER}-Beta 100% checklist`,
      `${MARKER}-Gamma workshop`,
      `${MARKER}-Alpha handbook`,
    ]);

    const downloads = ours(await listResources(claimsFor("pathways"), { sort: "downloads" }));
    expect(downloads).toEqual([
      `${MARKER}-Beta 100% checklist`,
      `${MARKER}-Alpha handbook`,
      `${MARKER}-Gamma workshop`,
    ]);

    const title = ours(await listResources(claimsFor("pathways"), { sort: "title" }));
    expect(title).toEqual([
      `${MARKER}-Alpha handbook`,
      `${MARKER}-Beta 100% checklist`,
      `${MARKER}-Gamma workshop`,
    ]);
  });

  it("Independent Test: Pathways search/filter/sort never includes LEAD-only", async () => {
    await seedCatalog();
    const session = claimsFor("pathways");
    const queries = [
      { q: "Alpha" },
      { q: "reentry" },
      { tags: ["handbook"] },
      { source: "Amend" },
      { sort: "newest" as const },
      { sort: "downloads" as const },
      { sort: "title" as const },
      { q: "Alpha", tags: ["handbook"], source: "Amend", sort: "downloads" as const },
    ];
    for (const query of queries) {
      const titles = ours(await listResources(session, query));
      expect(titles).not.toContain(`${MARKER}-Alpha handbook LEAD`);
      expect(titles).not.toContain(`${MARKER}-Alpha withdrawn`);
    }
  });
});
