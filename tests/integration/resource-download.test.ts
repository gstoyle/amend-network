import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { migrator } from "@/lib/db/migrator";
import { getResource } from "@/lib/resources/list";
import { grantDownload, grantFile } from "@/lib/resources/download";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `dl-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

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
      tags: [],
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

const grantInput = { ip: IP, userAgent: USER_AGENT };

describe("member resource download (US3 / FR-011)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdIds.length > 0) {
      await migrator.resource.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("visible download returns a 900s signed GET, bumps count, and writes resource_downloaded in the same grant", async () => {
    const id = await insertLive({
      title: `${MARKER}-ok`,
      visibility: ["pathways"],
      downloadCount: 2,
    });
    createdIds.push(id);
    const url = await grantDownload(claimsFor("pathways"), id, grantInput);
    expect(url).toEqual(expect.stringMatching(/^https?:\/\//i));
    expect(url).toMatch(/X-Amz-Expires=900/i);
    expect(url).toMatch(/X-Amz-Signature=/i);
    const row = await migrator.resource.findUnique({ where: { id } });
    expect(row?.downloadCount).toBe(3);
    const audit = await migrator.auditLog.findMany({
      where: { action: "resource_downloaded", entityId: id, userAgent: USER_AGENT },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorUserId).toBe(claimsFor("pathways")!.userId);
    expect(audit[0]?.ip).toBe(IP);
    expect(audit[0]?.entityType).toBe("resource");
    expect(JSON.stringify(audit[0]?.metadata ?? {})).not.toMatch(/file_object_key|https?:\/\//i);
  });

  it("LEAD-only, withdrawn, unknown, and pending produce no file, no count bump, and no audit", async () => {
    const leadOnly = await insertLive({
      title: `${MARKER}-lead`,
      visibility: ["lead"],
      downloadCount: 1,
    });
    const withdrawn = await insertLive({
      title: `${MARKER}-gone`,
      visibility: ["pathways"],
      deletedAt: new Date(),
      downloadCount: 4,
    });
    createdIds.push(leadOnly, withdrawn);
    const unknown = randomUUID();

    expect(await grantDownload(claimsFor("pathways"), leadOnly, grantInput)).toBeNull();
    expect(await grantDownload(claimsFor("pathways"), withdrawn, grantInput)).toBeNull();
    expect(await grantDownload(claimsFor("pathways"), unknown, grantInput)).toBeNull();
    await expect(
      grantDownload(claimsFor("pending"), leadOnly, grantInput),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    expect((await migrator.resource.findUnique({ where: { id: leadOnly } }))?.downloadCount).toBe(1);
    expect((await migrator.resource.findUnique({ where: { id: withdrawn } }))?.downloadCount).toBe(
      4,
    );
    expect(
      await migrator.auditLog.count({
        where: { action: "resource_downloaded", userAgent: USER_AGENT },
      }),
    ).toBe(0);
  });

  it("file grant is a 900s signed GET with no count bump and no resource_downloaded", async () => {
    const id = await insertLive({
      title: `${MARKER}-file`,
      visibility: ["pathways"],
      downloadCount: 5,
    });
    createdIds.push(id);
    const url = await grantFile(claimsFor("pathways"), id);
    expect(url).toEqual(expect.stringMatching(/^https?:\/\//i));
    expect(url).toMatch(/X-Amz-Expires=900/i);
    expect((await migrator.resource.findUnique({ where: { id } }))?.downloadCount).toBe(5);
    expect(
      await migrator.auditLog.count({
        where: { action: "resource_downloaded", entityId: id },
      }),
    ).toBe(0);
  });

  it("Independent Test: Pathways downloads shared + Pathways-only with audit each; denials withhold; no durable storage URL", async () => {
    const shared = await insertLive({
      title: `${MARKER}-shared`,
      visibility: ["all_authenticated"],
    });
    const pathwaysOnly = await insertLive({
      title: `${MARKER}-path`,
      visibility: ["pathways"],
    });
    const leadOnly = await insertLive({ title: `${MARKER}-lead2`, visibility: ["lead"] });
    const withdrawn = await insertLive({
      title: `${MARKER}-withdrawn`,
      visibility: ["all_authenticated"],
      deletedAt: new Date(),
    });
    createdIds.push(shared, pathwaysOnly, leadOnly, withdrawn);

    const sharedUrl = await grantDownload(claimsFor("pathways"), shared, grantInput);
    const pathUrl = await grantDownload(claimsFor("pathways"), pathwaysOnly, grantInput);
    expect(sharedUrl).toMatch(/X-Amz-Signature=/i);
    expect(pathUrl).toMatch(/X-Amz-Signature=/i);
    expect(sharedUrl).not.toEqual(pathUrl);

    expect((await migrator.resource.findUnique({ where: { id: shared } }))?.downloadCount).toBe(1);
    expect((await migrator.resource.findUnique({ where: { id: pathwaysOnly } }))?.downloadCount).toBe(
      1,
    );
    const audits = await migrator.auditLog.findMany({
      where: {
        action: "resource_downloaded",
        userAgent: USER_AGENT,
        entityId: { in: [shared, pathwaysOnly] },
      },
    });
    expect(audits).toHaveLength(2);
    expect(audits.every((row) => row.actorUserId && row.ip && row.entityId)).toBe(true);

    expect(await grantDownload(claimsFor("pathways"), leadOnly, grantInput)).toBeNull();
    expect(await grantDownload(claimsFor("pathways"), withdrawn, grantInput)).toBeNull();
    await expect(
      grantDownload(claimsFor("pending"), shared, grantInput),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    const listed = await getResource(claimsFor("pathways"), shared);
    expect(listed).not.toHaveProperty("fileObjectKey");
    expect(listed?.thumbnailHref).toBe(`/app/resources/${shared}/thumbnail`);
    expect(JSON.stringify(listed)).not.toMatch(/X-Amz-|127\.0\.0\.1:9000|minio/i);
  });
});
