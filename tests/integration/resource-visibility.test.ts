import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import type { AdminRole } from "@/lib/auth/types";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { getResource, grantThumbnail, listResources } from "@/lib/resources/list";
import { mintIngestSlots } from "@/lib/resources/publish";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `vis-${randomUUID()}`;

async function insertLive(input: {
  title: string;
  visibility: string[];
  deletedAt?: Date | null;
  downloadCount?: number;
}): Promise<string> {
  const row = await migrator.resource.create({
    data: {
      id: randomUUID(),
      title: input.title,
      previewText: `Preview for ${input.title}`,
      thumbnailObjectKey: `seed/${randomUUID()}/thumb.png`,
      sourceLabel: "Amend",
      tags: ["guide"],
      fileObjectKey: `seed/${randomUUID()}/file.pdf`,
      fileSizeBytes: BigInt(1024),
      fileMimeType: "application/pdf",
      visibility: input.visibility,
      downloadCount: input.downloadCount ?? 0,
      uploadedBy: randomUUID(),
      deletedAt: input.deletedAt ?? null,
    },
  });
  return row.id;
}

describe("member resource visibility (US2 / FR-006–FR-010)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    if (createdIds.length > 0) {
      await migrator.resource.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("pathways list sees shared and pathways, not lead-only or withdrawn", async () => {
    const shared = await insertLive({ title: `${MARKER}-shared`, visibility: ["all_authenticated"] });
    const pathways = await insertLive({ title: `${MARKER}-path`, visibility: ["pathways"] });
    const both = await insertLive({ title: `${MARKER}-both`, visibility: ["pathways", "lead"] });
    const lead = await insertLive({ title: `${MARKER}-lead`, visibility: ["lead"] });
    const withdrawn = await insertLive({
      title: `${MARKER}-gone`,
      visibility: ["all_authenticated"],
      deletedAt: new Date(),
    });
    createdIds.push(shared, pathways, both, lead, withdrawn);

    const listed = await listResources(claimsFor("pathways"));
    const titles = listed.map((row) => row.title);
    expect(titles).toEqual(
      expect.arrayContaining([`${MARKER}-shared`, `${MARKER}-path`, `${MARKER}-both`]),
    );
    expect(titles).not.toContain(`${MARKER}-lead`);
    expect(titles).not.toContain(`${MARKER}-gone`);
    expect(listed.every((row) => !("fileObjectKey" in row) && !("thumbnailObjectKey" in row))).toBe(
      true,
    );
  });

  it("lead list withholds pathways-only in reverse", async () => {
    const pathways = await insertLive({ title: `${MARKER}-p-only`, visibility: ["pathways"] });
    const lead = await insertLive({ title: `${MARKER}-l-only`, visibility: ["lead"] });
    createdIds.push(pathways, lead);
    const titles = (await listResources(claimsFor("lead"))).map((row) => row.title);
    expect(titles).toContain(`${MARKER}-l-only`);
    expect(titles).not.toContain(`${MARKER}-p-only`);
  });

  it("detail returns last-updated and guessed ids withhold without naming the other cohort", async () => {
    const visible = await insertLive({ title: `${MARKER}-detail`, visibility: ["pathways"] });
    const leadOnly = await insertLive({ title: `${MARKER}-secret`, visibility: ["lead"] });
    const withdrawn = await insertLive({
      title: `${MARKER}-withdrawn`,
      visibility: ["pathways"],
      deletedAt: new Date(),
    });
    createdIds.push(visible, leadOnly, withdrawn);

    const detail = await getResource(claimsFor("pathways"), visible);
    expect(detail?.title).toBe(`${MARKER}-detail`);
    expect(detail?.updatedAt).toBeInstanceOf(Date);
    expect(detail).not.toHaveProperty("fileObjectKey");

    const hidden = await getResource(claimsFor("pathways"), leadOnly);
    expect(hidden).toBeNull();
    const gone = await getResource(claimsFor("pathways"), withdrawn);
    expect(gone).toBeNull();
    const unknown = await getResource(claimsFor("pathways"), randomUUID());
    expect(unknown).toBeNull();
  });

  it("pending is denied and receives 0 resource records", async () => {
    const shared = await insertLive({ title: `${MARKER}-pend`, visibility: ["all_authenticated"] });
    createdIds.push(shared);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(listResources(claimsFor("pending"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(getResource(claimsFor("pending"), shared)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("thumbnail grant is 120s signed GET with no download audit or count bump", async () => {
    const id = await insertLive({
      title: `${MARKER}-thumb`,
      visibility: ["pathways"],
      downloadCount: 3,
    });
    createdIds.push(id);
    const url = await grantThumbnail(claimsFor("pathways"), id);
    expect(url).toEqual(expect.stringMatching(/^https?:\/\//i));
    expect(url).toMatch(/X-Amz-Expires=120/i);
    const row = await migrator.resource.findUnique({ where: { id } });
    expect(row?.downloadCount).toBe(3);
    const downloaded = await migrator.auditLog.count({
      where: { action: "resource_downloaded", entityId: id },
    });
    expect(downloaded).toBe(0);
    await expect(grantThumbnail(claimsFor("pathways"), randomUUID())).resolves.toBeNull();
  });

  it("Independent Test: seeded visibilities; list/detail by role; guessed ids; RLS; moderator cannot publish", async () => {
    const seedTitles = {
      shared: "Seed shared PDF",
      pathways: "Seed Pathways PDF",
      lead: "Seed LEAD PDF",
      both: "Seed both-program PDF",
      withdrawn: "Seed withdrawn PDF",
    };
    const seeds = await migrator.resource.findMany({
      where: { title: { in: Object.values(seedTitles) } },
    });
    expect(seeds.map((row) => row.title).sort()).toEqual(Object.values(seedTitles).sort());
    const leadSeed = seeds.find((row) => row.title === seedTitles.lead);
    const withdrawnSeed = seeds.find((row) => row.title === seedTitles.withdrawn);
    expect(leadSeed).toBeDefined();
    expect(withdrawnSeed).toBeDefined();

    const pathwaysTitles = (await listResources(claimsFor("pathways"))).map((row) => row.title);
    expect(pathwaysTitles).toEqual(
      expect.arrayContaining([seedTitles.shared, seedTitles.pathways, seedTitles.both]),
    );
    expect(pathwaysTitles).not.toContain(seedTitles.lead);
    expect(pathwaysTitles).not.toContain(seedTitles.withdrawn);

    const leadTitles = (await listResources(claimsFor("lead"))).map((row) => row.title);
    expect(leadTitles).toEqual(
      expect.arrayContaining([seedTitles.shared, seedTitles.lead, seedTitles.both]),
    );
    expect(leadTitles).not.toContain(seedTitles.pathways);

    const moderatorTitles = (await listResources(claimsFor("moderator"))).map((row) => row.title);
    expect(moderatorTitles).toEqual(
      expect.arrayContaining([
        seedTitles.shared,
        seedTitles.pathways,
        seedTitles.lead,
        seedTitles.both,
      ]),
    );
    expect(moderatorTitles).not.toContain(seedTitles.withdrawn);

    expect(await getResource(claimsFor("pathways"), leadSeed!.id)).toBeNull();
    expect(await getResource(claimsFor("pathways"), withdrawnSeed!.id)).toBeNull();
    expect(await getResource(claimsFor("pathways"), randomUUID())).toBeNull();

    const rlsPathways = await withRls(
      { programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.resource.findMany({
          where: { title: { in: [seedTitles.pathways, seedTitles.lead, seedTitles.withdrawn] } },
        }),
    );
    expect(rlsPathways.map((row) => row.title)).toEqual([seedTitles.pathways]);

    const publishAccess = { admin: ["admin", "super_admin"] as AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), publishAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(mintIngestSlots(claimsFor("moderator"))).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });
});
