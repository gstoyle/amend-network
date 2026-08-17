import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import type { AdminRole } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { migrator } from "@/lib/db/migrator";
import {
  listAdminResources,
  mintIngestSlots,
  publishResource,
} from "@/lib/resources/publish";
import { putObject } from "@/lib/storage/client";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `pub-${randomUUID()}`;
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

async function uploadAndPublish(input: {
  title: string;
  visibility: string[];
  previewText?: string;
  tags?: string[];
  sourceLabel?: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
  fileBody?: Buffer;
}) {
  const slots = await mintIngestSlots(adminSession());
  await putObject(slots.fileKey, input.fileBody ?? MINIMAL_PDF, "application/pdf");
  await putObject(slots.thumbKey, MINIMAL_PNG, "image/png");
  return publishResource(adminSession(), {
    ingestId: slots.ingestId,
    title: input.title,
    previewText: input.previewText ?? `Preview for ${input.title}`,
    sourceLabel: input.sourceLabel ?? "Amend",
    tags: input.tags ?? [],
    visibility: input.visibility,
    fileMimeType: input.fileMimeType ?? "application/pdf",
    fileSizeBytes: input.fileSizeBytes ?? MINIMAL_PDF.length,
    thumbMimeType: "image/png",
    ip: IP,
    userAgent: USER_AGENT,
  });
}

describe("admin resource publish (US1)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdIds.length > 0) {
      await migrator.resource.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("MFA admin publish creates one downloadable row and resource_created", async () => {
    const title = `${MARKER}-one`;
    const result = await uploadAndPublish({
      title,
      visibility: ["all_authenticated"],
      tags: ["guide"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    createdIds.push(result.id);
    const row = await migrator.resource.findUnique({ where: { id: result.id } });
    expect(row?.title).toBe(title);
    expect(row?.deletedAt).toBeNull();
    expect(row?.visibility).toEqual(["all_authenticated"]);
    const audit = await migrator.auditLog.findMany({
      where: { action: "resource_created", entityId: result.id, userAgent: USER_AGENT },
    });
    expect(audit).toHaveLength(1);
  });

  it("rejects missing title, overlong preview, too many tags, and disallowed MIME with no row", async () => {
    const before = await migrator.resource.count({ where: { title: { startsWith: MARKER } } });
    const missingTitle = await uploadAndPublish({
      title: "   ",
      visibility: ["pathways"],
    });
    expect(missingTitle.ok).toBe(false);

    const longPreview = await uploadAndPublish({
      title: `${MARKER}-long`,
      visibility: ["pathways"],
      previewText: "x".repeat(501),
    });
    expect(longPreview.ok).toBe(false);

    const tooManyTags = await uploadAndPublish({
      title: `${MARKER}-tags`,
      visibility: ["pathways"],
      tags: Array.from({ length: 11 }, (_, index) => `tag${index}`),
    });
    expect(tooManyTags.ok).toBe(false);

    const badMime = await uploadAndPublish({
      title: `${MARKER}-mime`,
      visibility: ["pathways"],
      fileMimeType: "application/zip",
    });
    expect(badMime.ok).toBe(false);

    expect(await migrator.resource.count({ where: { title: { startsWith: MARKER } } })).toBe(
      before,
    );
  });

  it("Independent Test: Admin publishes shared + Pathways; list and visibility match; Moderator denied", async () => {
    const sharedTitle = `${MARKER}-shared`;
    const pathwaysTitle = `${MARKER}-pathways`;
    const shared = await uploadAndPublish({
      title: sharedTitle,
      visibility: ["all_authenticated"],
    });
    const pathwaysOnly = await uploadAndPublish({
      title: pathwaysTitle,
      visibility: ["pathways"],
    });
    expect(shared.ok).toBe(true);
    expect(pathwaysOnly.ok).toBe(true);
    if (!shared.ok || !pathwaysOnly.ok) {
      return;
    }
    createdIds.push(shared.id, pathwaysOnly.id);

    const adminList = await listAdminResources(adminSession());
    const adminTitles = adminList.map((row) => row.title);
    expect(adminTitles).toContain(sharedTitle);
    expect(adminTitles).toContain(pathwaysTitle);

    const pathwaysSeen = await withRls(
      { programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.resource.findMany({
          where: { title: { in: [sharedTitle, pathwaysTitle] } },
        }),
    );
    expect(pathwaysSeen.map((row) => row.title).sort()).toEqual(
      [pathwaysTitle, sharedTitle].sort(),
    );

    const leadSeen = await withRls(
      { programRole: "lead", adminRole: "none", status: "active" },
      (tx) =>
        tx.resource.findMany({
          where: { title: { in: [sharedTitle, pathwaysTitle] } },
        }),
    );
    expect(leadSeen.map((row) => row.title)).toEqual([sharedTitle]);

    const publishAccess = { admin: ["admin", "super_admin"] as AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), publishAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(mintIngestSlots(claimsFor("moderator"))).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(listAdminResources(claimsFor("moderator"))).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });
});
