import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { grantFile } from "@/lib/resources/download";
import { getResource } from "@/lib/resources/list";
import { mintIngestSlots, publishResource } from "@/lib/resources/publish";
import { deleteObject, putObject } from "@/lib/storage/client";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `video-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 72 72]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

const MINIMAL_MP4 = Buffer.from("ftypisommp4-fixture-not-eicar", "utf8");

const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

async function publishLive(input: {
  title: string;
  visibility: string[];
  fileMimeType: "application/pdf" | "video/mp4";
  fileBody: Buffer;
}) {
  const slots = await mintIngestSlots(adminSession());
  await putObject(slots.fileKey, input.fileBody, input.fileMimeType);
  await putObject(slots.thumbKey, MINIMAL_PNG, "image/png");
  return publishResource(adminSession(), {
    ingestId: slots.ingestId,
    title: input.title,
    previewText: `Preview for ${input.title}`,
    sourceLabel: "Amend",
    tags: ["guide"],
    visibility: input.visibility,
    fileMimeType: input.fileMimeType,
    fileSizeBytes: input.fileBody.length,
    thumbMimeType: "image/png",
    ip: IP,
    userAgent: USER_AGENT,
  });
}

function expectNoDurableStorageUrl(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(/X-Amz-|minio|amazonaws|\.s3\.|dreamobjects/i);
}

describe("in-page video playback (US8 / FR-019)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdIds.length > 0) {
      const rows = await migrator.resource.findMany({
        where: { id: { in: createdIds } },
        select: { fileObjectKey: true, thumbnailObjectKey: true },
      });
      await Promise.all(
        rows.flatMap((row) => [
          deleteObject(row.fileObjectKey).catch(() => undefined),
          deleteObject(row.thumbnailObjectKey).catch(() => undefined),
        ]),
      );
      await migrator.resource.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("Pathways can play a visible MP4 via /file without a download audit", async () => {
    const created = await publishLive({
      title: `${MARKER}-play`,
      visibility: ["pathways"],
      fileMimeType: "video/mp4",
      fileBody: MINIMAL_MP4,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);

    const detail = await getResource(claimsFor("pathways"), created.id);
    expect(detail?.fileMimeType).toBe("video/mp4");
    expect(detail?.playbackHref).toBe(`/app/resources/${created.id}/file`);
    expectNoDurableStorageUrl(detail);

    const before = await migrator.resource.findUnique({ where: { id: created.id } });
    const playback = await grantFile(claimsFor("pathways"), created.id);
    expect(playback).toMatch(/^https?:\/\//i);
    expect(playback).toMatch(/X-Amz-Expires=900/i);

    const after = await migrator.resource.findUnique({ where: { id: created.id } });
    expect(after?.downloadCount).toBe(before?.downloadCount);
    expect(
      await migrator.auditLog.count({
        where: { action: "resource_downloaded", entityId: created.id },
      }),
    ).toBe(0);
  });

  it("non-video detail stays download, not a player", async () => {
    const created = await publishLive({
      title: `${MARKER}-pdf`,
      visibility: ["all_authenticated"],
      fileMimeType: "application/pdf",
      fileBody: MINIMAL_PDF,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);
    const detail = await getResource(claimsFor("pathways"), created.id);
    expect(detail?.fileMimeType).toBe("application/pdf");
    expect(detail?.playbackHref).toBeNull();
    expectNoDurableStorageUrl(detail);
  });

  it("Independent Test: Pathways plays a Pathways MP4; LEAD is withheld; no durable storage URL", async () => {
    const created = await publishLive({
      title: `${MARKER}-ind`,
      visibility: ["pathways"],
      fileMimeType: "video/mp4",
      fileBody: MINIMAL_MP4,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);

    const pathways = await getResource(claimsFor("pathways"), created.id);
    expect(pathways?.fileMimeType).toBe("video/mp4");
    expect(pathways?.playbackHref).toBe(`/app/resources/${created.id}/file`);
    expectNoDurableStorageUrl(pathways);
    expect(await grantFile(claimsFor("pathways"), created.id)).toMatch(/^https?:\/\//i);

    expect(await getResource(claimsFor("lead"), created.id)).toBeNull();
    expect(await grantFile(claimsFor("lead"), created.id)).toBeNull();
  });
});
