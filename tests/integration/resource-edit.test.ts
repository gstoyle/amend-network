import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { migrator } from "@/lib/db/migrator";
import { grantFile } from "@/lib/resources/download";
import {
  getAdminResource,
  replaceResource,
  updateResource,
} from "@/lib/resources/edit";
import { getResource } from "@/lib/resources/list";
import { mintIngestSlots, publishResource } from "@/lib/resources/publish";
import { deleteObject, getObjectBytes, putObject } from "@/lib/storage/client";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `edit-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 72 72]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

const REPLACEMENT_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 72 72]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n%replaced\n",
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

async function publishLive(input: { title: string; visibility: string[] }) {
  const slots = await mintIngestSlots(adminSession());
  await putObject(slots.fileKey, MINIMAL_PDF, "application/pdf");
  await putObject(slots.thumbKey, MINIMAL_PNG, "image/png");
  const result = await publishResource(adminSession(), {
    ingestId: slots.ingestId,
    title: input.title,
    previewText: `Preview for ${input.title}`,
    sourceLabel: "Amend",
    tags: ["guide"],
    visibility: input.visibility,
    fileMimeType: "application/pdf",
    fileSizeBytes: MINIMAL_PDF.length,
    thumbMimeType: "image/png",
    ip: IP,
    userAgent: USER_AGENT,
  });
  return result;
}

describe("admin resource edit and replace (US6 / FR-016)", () => {
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

  it("updates metadata in place, advances last-updated, and writes resource_edited", async () => {
    const created = await publishLive({
      title: `${MARKER}-meta`,
      visibility: ["all_authenticated"],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);
    const before = await migrator.resource.findUnique({ where: { id: created.id } });
    await new Promise((resolve) => setTimeout(resolve, 25));

    const updated = await updateResource(adminSession(), {
      resourceId: created.id,
      title: `${MARKER}-renamed`,
      previewText: "Updated preview",
      sourceLabel: "Partner Org",
      tags: ["handbook"],
      visibility: ["all_authenticated"],
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.id).toBe(created.id);

    const after = await migrator.resource.findUnique({ where: { id: created.id } });
    expect(after?.title).toBe(`${MARKER}-renamed`);
    expect(after?.previewText).toBe("Updated preview");
    expect(after?.sourceLabel).toBe("Partner Org");
    expect(after?.tags).toEqual(["handbook"]);
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());

    const member = await getResource(claimsFor("pathways"), created.id);
    expect(member?.title).toBe(`${MARKER}-renamed`);
    expect(member?.updatedAt.getTime()).toBe(after!.updatedAt.getTime());

    const audit = await migrator.auditLog.findMany({
      where: { action: "resource_edited", entityId: created.id, userAgent: USER_AGENT },
    });
    expect(audit).toHaveLength(1);
  });

  it("tightening visibility withholds the other cohort without changing id", async () => {
    const created = await publishLive({
      title: `${MARKER}-both`,
      visibility: ["pathways", "lead"],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);

    const updated = await updateResource(adminSession(), {
      resourceId: created.id,
      title: `${MARKER}-both`,
      previewText: `Preview for ${MARKER}-both`,
      sourceLabel: "Amend",
      tags: ["guide"],
      visibility: ["pathways"],
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.id).toBe(created.id);

    expect(await getResource(claimsFor("pathways"), created.id)).not.toBeNull();
    expect(await grantFile(claimsFor("pathways"), created.id)).toMatch(/^https?:\/\//);
    expect(await getResource(claimsFor("lead"), created.id)).toBeNull();
    expect(await grantFile(claimsFor("lead"), created.id)).toBeNull();
  });

  it("clean replace keeps the id, serves the new file, and deletes previous live keys", async () => {
    const created = await publishLive({
      title: `${MARKER}-file`,
      visibility: ["all_authenticated"],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);
    const before = await migrator.resource.findUnique({ where: { id: created.id } });
    const oldFile = before!.fileObjectKey;
    const oldThumb = before!.thumbnailObjectKey;
    await new Promise((resolve) => setTimeout(resolve, 25));

    const ingest = await mintIngestSlots(adminSession());
    await putObject(ingest.fileKey, REPLACEMENT_PDF, "application/pdf");
    await putObject(ingest.thumbKey, MINIMAL_PNG, "image/png");
    const replaced = await replaceResource(adminSession(), {
      resourceId: created.id,
      ingestId: ingest.ingestId,
      fileMimeType: "application/pdf",
      fileSizeBytes: REPLACEMENT_PDF.length,
      thumbMimeType: "image/png",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.id).toBe(created.id);

    const after = await migrator.resource.findUnique({ where: { id: created.id } });
    expect(after?.fileObjectKey).not.toBe(oldFile);
    expect(after?.thumbnailObjectKey).not.toBe(oldThumb);
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
    expect(await getObjectBytes(oldFile)).toBeNull();
    expect(await getObjectBytes(oldThumb)).toBeNull();
    expect(await getObjectBytes(after!.fileObjectKey)).toEqual(REPLACEMENT_PDF);
    expect(await grantFile(claimsFor("pathways"), created.id)).toMatch(/^https?:\/\//);
  });

  it("Independent Test: edit title, replace file, id stable, members get new file, Moderator cannot edit", async () => {
    const created = await publishLive({
      title: `${MARKER}-ind`,
      visibility: ["all_authenticated"],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);
    const originalId = created.id;
    await new Promise((resolve) => setTimeout(resolve, 25));

    const renamed = await updateResource(adminSession(), {
      resourceId: originalId,
      title: `${MARKER}-ind-edited`,
      previewText: "Independent preview",
      sourceLabel: "Amend",
      tags: ["guide"],
      visibility: ["all_authenticated"],
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) {
      return;
    }
    expect(renamed.id).toBe(originalId);

    const ingest = await mintIngestSlots(adminSession());
    await putObject(ingest.fileKey, REPLACEMENT_PDF, "application/pdf");
    await putObject(ingest.thumbKey, MINIMAL_PNG, "image/png");
    const replaced = await replaceResource(adminSession(), {
      resourceId: originalId,
      ingestId: ingest.ingestId,
      fileMimeType: "application/pdf",
      fileSizeBytes: REPLACEMENT_PDF.length,
      thumbMimeType: "image/png",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.id).toBe(originalId);

    const row = await migrator.resource.findUnique({ where: { id: originalId } });
    expect(row?.title).toBe(`${MARKER}-ind-edited`);
    expect(await getObjectBytes(row!.fileObjectKey)).toEqual(REPLACEMENT_PDF);
    const member = await getResource(claimsFor("pathways"), originalId);
    expect(member?.title).toBe(`${MARKER}-ind-edited`);
    expect(member?.updatedAt.getTime()).toBe(row!.updatedAt.getTime());

    const edited = await migrator.auditLog.count({
      where: { action: "resource_edited", entityId: originalId, userAgent: USER_AGENT },
    });
    expect(edited).toBeGreaterThanOrEqual(2);

    const loaded = await getAdminResource(adminSession(), originalId);
    expect(loaded?.id).toBe(originalId);
    expect(loaded).not.toHaveProperty("fileObjectKey");

    await expect(
      updateResource(claimsFor("moderator"), {
        resourceId: originalId,
        title: "should not stick",
        previewText: "nope",
        sourceLabel: "Amend",
        tags: [],
        visibility: ["all_authenticated"],
        ip: IP,
        userAgent: USER_AGENT,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(
      replaceResource(claimsFor("moderator"), {
        resourceId: originalId,
        ingestId: randomUUID(),
        fileMimeType: "application/pdf",
        fileSizeBytes: 10,
        thumbMimeType: "image/png",
        ip: IP,
        userAgent: USER_AGENT,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(getAdminResource(claimsFor("moderator"), originalId)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );

    const unchanged = await migrator.resource.findUnique({ where: { id: originalId } });
    expect(unchanged?.title).toBe(`${MARKER}-ind-edited`);
  });
});
