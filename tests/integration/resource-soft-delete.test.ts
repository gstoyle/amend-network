import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { migrator } from "@/lib/db/migrator";
import { grantDownload, grantFile } from "@/lib/resources/download";
import { getAdminResource, withdrawResource } from "@/lib/resources/edit";
import { getResource, grantThumbnail, listResources } from "@/lib/resources/list";
import { listAdminResources, mintIngestSlots, publishResource } from "@/lib/resources/publish";
import { deleteObject, getObjectBytes, putObject } from "@/lib/storage/client";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `withdraw-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

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

async function publishLive(title: string) {
  const slots = await mintIngestSlots(adminSession());
  await putObject(slots.fileKey, MINIMAL_PDF, "application/pdf");
  await putObject(slots.thumbKey, MINIMAL_PNG, "image/png");
  return publishResource(adminSession(), {
    ingestId: slots.ingestId,
    title,
    previewText: `Preview for ${title}`,
    sourceLabel: "Amend",
    tags: ["guide"],
    visibility: ["all_authenticated"],
    fileMimeType: "application/pdf",
    fileSizeBytes: MINIMAL_PDF.length,
    thumbMimeType: "image/png",
    ip: IP,
    userAgent: USER_AGENT,
  });
}

describe("admin resource soft-delete (US7 / FR-017)", () => {
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

  it("sets deleted_at, writes resource_deleted, and retains storage objects", async () => {
    const title = `${MARKER}-keep`;
    const created = await publishLive(title);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);
    const before = await migrator.resource.findUnique({ where: { id: created.id } });
    const fileBytes = await getObjectBytes(before!.fileObjectKey);
    const thumbBytes = await getObjectBytes(before!.thumbnailObjectKey);
    expect(fileBytes).not.toBeNull();
    expect(thumbBytes).not.toBeNull();

    const withdrawn = await withdrawResource(adminSession(), {
      resourceId: created.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(withdrawn.ok).toBe(true);
    if (!withdrawn.ok) {
      return;
    }
    expect(withdrawn.id).toBe(created.id);

    const after = await migrator.resource.findUnique({ where: { id: created.id } });
    expect(after?.deletedAt).toBeInstanceOf(Date);
    expect(await getObjectBytes(after!.fileObjectKey)).toEqual(fileBytes);
    expect(await getObjectBytes(after!.thumbnailObjectKey)).toEqual(thumbBytes);

    const audit = await migrator.auditLog.findMany({
      where: { action: "resource_deleted", entityId: created.id, userAgent: USER_AGENT },
    });
    expect(audit).toHaveLength(1);
  });

  it("withholds list, search, detail, and download the same as an unknown id", async () => {
    const title = `${MARKER}-hidden`;
    const created = await publishLive(title);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);
    await withdrawResource(adminSession(), {
      resourceId: created.id,
      ip: IP,
      userAgent: USER_AGENT,
    });

    const unknownId = randomUUID();
    const member = claimsFor("pathways");
    expect(await getResource(member, created.id)).toBeNull();
    expect(await getResource(member, unknownId)).toBeNull();
    expect(await grantFile(member, created.id)).toBeNull();
    expect(await grantFile(member, unknownId)).toBeNull();
    expect(await grantThumbnail(member, created.id)).toBeNull();
    expect(
      await grantDownload(member, created.id, { ip: IP, userAgent: USER_AGENT }),
    ).toBeNull();
    expect((await listResources(member)).map((row) => row.title)).not.toContain(title);
    expect(
      (await listResources(member, { q: "hidden" })).map((row) => row.title),
    ).not.toContain(title);
  });

  it("Independent Test: members lose access; admin still sees withdrawn; Moderator cannot delete", async () => {
    const title = `${MARKER}-ind`;
    const created = await publishLive(title);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);
    expect(await getResource(claimsFor("pathways"), created.id)).not.toBeNull();

    const withdrawn = await withdrawResource(adminSession(), {
      resourceId: created.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(withdrawn.ok).toBe(true);

    const member = claimsFor("pathways");
    expect(await getResource(member, created.id)).toBeNull();
    expect(await grantFile(member, created.id)).toBeNull();
    expect((await listResources(member)).map((row) => row.title)).not.toContain(title);

    const adminList = await listAdminResources(adminSession());
    const listed = adminList.find((row) => row.id === created.id);
    expect(listed?.title).toBe(title);
    expect(listed?.deletedAt).toBeInstanceOf(Date);

    const adminDetail = await getAdminResource(adminSession(), created.id);
    expect(adminDetail?.deletedAt).toBeInstanceOf(Date);
    expect(adminDetail).not.toHaveProperty("fileObjectKey");

    await expect(
      withdrawResource(claimsFor("moderator"), {
        resourceId: created.id,
        ip: IP,
        userAgent: USER_AGENT,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    const still = await migrator.resource.findUnique({ where: { id: created.id } });
    expect(still?.deletedAt).toBeInstanceOf(Date);
    expect(
      await migrator.auditLog.count({
        where: { action: "resource_deleted", entityId: created.id, userAgent: USER_AGENT },
      }),
    ).toBe(1);
  });
});
