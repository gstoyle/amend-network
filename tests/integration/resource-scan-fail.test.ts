import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { grantDownload, grantFile } from "@/lib/resources/download";
import { grantThumbnail, listResources } from "@/lib/resources/list";
import {
  mintIngestSlots,
  publishResource,
  replaceResource,
  type PublishResult,
} from "@/lib/resources/publish";
import { EICAR } from "@/lib/scan/clamav";
import { deleteObject, getObjectBytes, putObject } from "@/lib/storage/client";
import { migrator } from "@/lib/db/migrator";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `scan-fail-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";
const GENERIC = /could not publish this file/i;
const EICAR_BODY = Buffer.from(EICAR, "ascii");

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 72 72]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

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

function memberSession() {
  return claimsFor("pathways")!;
}

async function publishClean(title: string) {
  const slots = await mintIngestSlots(adminSession());
  await putObject(slots.fileKey, MINIMAL_PDF, "application/pdf");
  await putObject(slots.thumbKey, MINIMAL_PNG, "image/png");
  return {
    slots,
    result: await publishResource(adminSession(), {
      ingestId: slots.ingestId,
      title,
      previewText: `Preview for ${title}`,
      sourceLabel: "Amend",
      tags: [],
      visibility: ["all_authenticated"],
      fileMimeType: "application/pdf",
      fileSizeBytes: MINIMAL_PDF.length,
      thumbMimeType: "image/png",
      ip: IP,
      userAgent: USER_AGENT,
    }),
  };
}

async function attemptPublish(input: {
  title: string;
  fileBody: Buffer;
  thumbBody: Buffer;
}) {
  const slots = await mintIngestSlots(adminSession());
  await putObject(slots.fileKey, input.fileBody, "application/pdf");
  await putObject(slots.thumbKey, input.thumbBody, "image/png");
  const result = await publishResource(adminSession(), {
    ingestId: slots.ingestId,
    title: input.title,
    previewText: `Preview for ${input.title}`,
    sourceLabel: "Amend",
    tags: [],
    visibility: ["all_authenticated"],
    fileMimeType: "application/pdf",
    fileSizeBytes: input.fileBody.length,
    thumbMimeType: "image/png",
    ip: IP,
    userAgent: USER_AGENT,
  });
  return { slots, result };
}

function expectGenericAdminFailure(result: PublishResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error).toMatch(GENERIC);
  expect(result.error.toLowerCase()).not.toMatch(/eicar|infected|clam|found|scanner/);
}

async function expectObjectsGone(keys: string[]) {
  for (const key of keys) {
    expect(await getObjectBytes(key)).toBeNull();
  }
}

async function expectNotVisibleOrDownloadable(title: string) {
  expect(await migrator.resource.count({ where: { title } })).toBe(0);
  const listed = await listResources(memberSession());
  expect(listed.map((row) => row.title)).not.toContain(title);
  const created = await migrator.auditLog.count({
    where: { action: "resource_created", userAgent: USER_AGENT },
  });
  expect(created).toBe(0);
}

describe("resource scan-fail ingest (US4)", () => {
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

  it("rejects an EICAR main file: no row, ingest keys deleted, generic admin error", async () => {
    const title = `${MARKER}-eicar-file`;
    const { slots, result } = await attemptPublish({
      title,
      fileBody: EICAR_BODY,
      thumbBody: MINIMAL_PNG,
    });
    expectGenericAdminFailure(result);
    await expectObjectsGone([slots.fileKey, slots.thumbKey]);
    await expectNotVisibleOrDownloadable(title);
    expect(await grantDownload(memberSession(), randomUUID(), { ip: IP, userAgent: USER_AGENT })).toBeNull();
  });

  it("rejects a clean file + EICAR thumbnail: no row, ingest keys deleted", async () => {
    const title = `${MARKER}-eicar-thumb`;
    const { slots, result } = await attemptPublish({
      title,
      fileBody: MINIMAL_PDF,
      thumbBody: EICAR_BODY,
    });
    expectGenericAdminFailure(result);
    await expectObjectsGone([slots.fileKey, slots.thumbKey]);
    await expectNotVisibleOrDownloadable(title);
  });

  it("failed replace deletes only new ingest and leaves live keys unchanged", async () => {
    const title = `${MARKER}-replace`;
    const published = await publishClean(title);
    expect(published.result.ok).toBe(true);
    if (!published.result.ok) {
      return;
    }
    createdIds.push(published.result.id);
    const live = await migrator.resource.findUnique({ where: { id: published.result.id } });
    expect(live).not.toBeNull();
    const liveFile = live!.fileObjectKey;
    const liveThumb = live!.thumbnailObjectKey;
    expect(await getObjectBytes(liveFile)).not.toBeNull();
    expect(await getObjectBytes(liveThumb)).not.toBeNull();

    const ingest = await mintIngestSlots(adminSession());
    await putObject(ingest.fileKey, EICAR_BODY, "application/pdf");
    await putObject(ingest.thumbKey, MINIMAL_PNG, "image/png");
    const replaced = await replaceResource(adminSession(), {
      resourceId: published.result.id,
      ingestId: ingest.ingestId,
      fileMimeType: "application/pdf",
      fileSizeBytes: EICAR_BODY.length,
      thumbMimeType: "image/png",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expectGenericAdminFailure(replaced);
    await expectObjectsGone([ingest.fileKey, ingest.thumbKey]);

    const after = await migrator.resource.findUnique({ where: { id: published.result.id } });
    expect(after?.fileObjectKey).toBe(liveFile);
    expect(after?.thumbnailObjectKey).toBe(liveThumb);
    expect(await getObjectBytes(liveFile)).not.toBeNull();
    expect(await getObjectBytes(liveThumb)).not.toBeNull();

    const download = await grantFile(memberSession(), published.result.id);
    expect(download).toMatch(/^https?:\/\//);
    expect(await grantThumbnail(memberSession(), published.result.id)).toMatch(/^https?:\/\//);
  });

  it("Independent Test: infected file or thumb never goes live; failed replace still serves the previous file", async () => {
    const infectedFileTitle = `${MARKER}-ind-file`;
    const infectedThumbTitle = `${MARKER}-ind-thumb`;
    const liveTitle = `${MARKER}-ind-live`;

    const infectedFile = await attemptPublish({
      title: infectedFileTitle,
      fileBody: EICAR_BODY,
      thumbBody: MINIMAL_PNG,
    });
    expectGenericAdminFailure(infectedFile.result);
    await expectObjectsGone([infectedFile.slots.fileKey, infectedFile.slots.thumbKey]);

    const infectedThumb = await attemptPublish({
      title: infectedThumbTitle,
      fileBody: MINIMAL_PDF,
      thumbBody: EICAR_BODY,
    });
    expectGenericAdminFailure(infectedThumb.result);
    await expectObjectsGone([infectedThumb.slots.fileKey, infectedThumb.slots.thumbKey]);

    const live = await publishClean(liveTitle);
    expect(live.result.ok).toBe(true);
    if (!live.result.ok) {
      return;
    }
    createdIds.push(live.result.id);
    const liveRow = await migrator.resource.findUnique({ where: { id: live.result.id } });
    const liveFileKey = liveRow!.fileObjectKey;

    const ingest = await mintIngestSlots(adminSession());
    await putObject(ingest.fileKey, EICAR_BODY, "application/pdf");
    await putObject(ingest.thumbKey, MINIMAL_PNG, "image/png");
    const replaced = await replaceResource(adminSession(), {
      resourceId: live.result.id,
      ingestId: ingest.ingestId,
      fileMimeType: "application/pdf",
      fileSizeBytes: EICAR_BODY.length,
      thumbMimeType: "image/png",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expectGenericAdminFailure(replaced);
    await expectObjectsGone([ingest.fileKey, ingest.thumbKey]);
    expect(await getObjectBytes(liveFileKey)).not.toBeNull();

    const memberTitles = (await listResources(memberSession())).map((row) => row.title);
    expect(memberTitles).not.toContain(infectedFileTitle);
    expect(memberTitles).not.toContain(infectedThumbTitle);
    expect(memberTitles).toContain(liveTitle);
    expect(await grantDownload(memberSession(), live.result.id, { ip: IP, userAgent: USER_AGENT })).toMatch(
      /^https?:\/\//,
    );
    expect(
      await migrator.resource.count({
        where: { title: { in: [infectedFileTitle, infectedThumbTitle] } },
      }),
    ).toBe(0);
  });
});
