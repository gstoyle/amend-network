import { randomUUID } from "node:crypto";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { scanBytes } from "@/lib/scan/clamav";
import {
  deleteObject,
  getObjectBytes,
  presignPut,
  promoteObject,
} from "@/lib/storage/client";

const ADMIN_ROLES = ["admin", "super_admin"] as const;
const FILE_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "video/mp4",
] as const;
const THUMB_MIMES = ["image/jpeg", "image/png"] as const;
const SOURCES = ["Amend", "Partner Org", "External"] as const;
const VISIBILITY = ["all_authenticated", "pathways", "lead"] as const;
const MAX_FILE_BYTES = 262_144_000;
const MAX_THUMB_BYTES = 5 * 1024 * 1024;
const GENERIC_PUBLISH_ERROR = "Could not publish this file.";

const publishSchema = z.object({
  ingestId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required."),
  previewText: z
    .string()
    .trim()
    .min(1, "Preview text is required.")
    .max(500, "Preview text must be 500 characters or fewer."),
  sourceLabel: z.enum(SOURCES, { message: "Choose a valid source label." }),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(10, "Use 10 tags or fewer."),
  visibility: z
    .array(z.enum(VISIBILITY))
    .min(1, "Choose at least one visibility value."),
  fileMimeType: z.enum(FILE_MIMES, { message: "That file type is not allowed." }),
  fileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(MAX_FILE_BYTES, "File must be 250 MB or smaller."),
  thumbMimeType: z.enum(THUMB_MIMES, { message: "Thumbnail must be a JPEG or PNG." }),
});

const replaceSchema = z.object({
  resourceId: z.string().uuid(),
  ingestId: z.string().uuid(),
  fileMimeType: z.enum(FILE_MIMES, { message: "That file type is not allowed." }),
  fileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(MAX_FILE_BYTES, "File must be 250 MB or smaller."),
  thumbMimeType: z.enum(THUMB_MIMES, { message: "Thumbnail must be a JPEG or PNG." }),
});

export type PublishInput = {
  ingestId: string;
  title: string;
  previewText: string;
  sourceLabel: string;
  tags: string[];
  visibility: string[];
  fileMimeType: string;
  fileSizeBytes: number;
  thumbMimeType: string;
  ip: string;
  userAgent: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

export type PublishResult = { ok: true; id: string } | { ok: false; error: string };

export type ReplaceInput = {
  resourceId: string;
  ingestId: string;
  fileMimeType: string;
  fileSizeBytes: number;
  thumbMimeType: string;
  ip: string;
  userAgent: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

export type AdminResourceListItem = {
  id: string;
  title: string;
  visibility: string[];
  sourceLabel: string;
  deletedAt: Date | null;
  createdAt: Date;
};

function authorizePublisher(
  session: SessionClaims | null,
  options: Pick<PublishInput, "clientAdminRole" | "clientMfaSatisfied"> = {},
): SessionClaims {
  return requireRole(session, {
    admin: [...ADMIN_ROLES],
    mfa: true,
    clientAdminRole: options.clientAdminRole,
    clientMfaSatisfied: options.clientMfaSatisfied,
  });
}

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

function ingestKeys(ingestId: string): { fileKey: string; thumbKey: string } {
  return {
    fileKey: `ingest/${ingestId}/file`,
    thumbKey: `ingest/${ingestId}/thumb`,
  };
}

async function deleteKeys(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteObject(key);
      } catch {
        // Best-effort cleanup of rejected ingest or failed promote.
      }
    }),
  );
}

type ScannedIngest =
  | {
      ok: true;
      fileBytes: Buffer;
      thumbBytes: Buffer;
      keys: { fileKey: string; thumbKey: string };
    }
  | { ok: false; error: string };

async function scanIngest(ingestId: string): Promise<ScannedIngest> {
  const keys = ingestKeys(ingestId);
  const [fileBytes, thumbBytes] = await Promise.all([
    getObjectBytes(keys.fileKey),
    getObjectBytes(keys.thumbKey),
  ]);
  if (!fileBytes || !thumbBytes) {
    await deleteKeys([keys.fileKey, keys.thumbKey]);
    return { ok: false, error: "Upload did not complete." };
  }
  if (fileBytes.length > MAX_FILE_BYTES || thumbBytes.length > MAX_THUMB_BYTES) {
    await deleteKeys([keys.fileKey, keys.thumbKey]);
    return { ok: false, error: "File must be 250 MB or smaller." };
  }

  const [fileScan, thumbScan] = await Promise.all([
    scanBytes(fileBytes),
    scanBytes(thumbBytes),
  ]);
  if (fileScan !== "clean" || thumbScan !== "clean") {
    await deleteKeys([keys.fileKey, keys.thumbKey]);
    return { ok: false, error: GENERIC_PUBLISH_ERROR };
  }
  return { ok: true, fileBytes, thumbBytes, keys };
}

export async function mintIngestSlots(
  session: SessionClaims | null,
  input: {
    fileMimeType?: string;
    thumbMimeType?: string;
    clientAdminRole?: unknown;
    clientMfaSatisfied?: unknown;
  } = {},
): Promise<{
  ingestId: string;
  fileKey: string;
  thumbKey: string;
  filePutUrl: string;
  thumbPutUrl: string;
}> {
  authorizePublisher(session, input);
  const ingestId = randomUUID();
  const keys = ingestKeys(ingestId);
  const [filePutUrl, thumbPutUrl] = await Promise.all([
    presignPut(keys.fileKey, input.fileMimeType ?? "application/octet-stream"),
    presignPut(keys.thumbKey, input.thumbMimeType ?? "application/octet-stream"),
  ]);
  return { ingestId, ...keys, filePutUrl, thumbPutUrl };
}

export async function listAdminResources(
  session: SessionClaims | null,
  options: Pick<PublishInput, "clientAdminRole" | "clientMfaSatisfied"> = {},
): Promise<AdminResourceListItem[]> {
  const claims = authorizePublisher(session, options);
  return withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const rows = await tx.resource.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          visibility: true,
          sourceLabel: true,
          deletedAt: true,
          createdAt: true,
        },
      });
      return rows;
    },
  );
}

export async function publishResource(
  session: SessionClaims | null,
  input: PublishInput,
): Promise<PublishResult> {
  const claims = authorizePublisher(session, input);
  const parsed = publishSchema.safeParse({
    ingestId: input.ingestId,
    title: input.title,
    previewText: input.previewText,
    sourceLabel: input.sourceLabel,
    tags: input.tags,
    visibility: input.visibility,
    fileMimeType: input.fileMimeType,
    fileSizeBytes: input.fileSizeBytes,
    thumbMimeType: input.thumbMimeType,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Check the required fields.";
    return { ok: false, error: first };
  }

  const scanned = await scanIngest(parsed.data.ingestId);
  if (!scanned.ok) {
    return scanned;
  }

  const id = randomUUID();
  const liveFileKey = `resources/${id}/file`;
  const liveThumbKey = `resources/${id}/thumb`;
  try {
    await promoteObject(scanned.keys.fileKey, liveFileKey);
    await promoteObject(scanned.keys.thumbKey, liveThumbKey);
  } catch {
    await deleteKeys([
      scanned.keys.fileKey,
      scanned.keys.thumbKey,
      liveFileKey,
      liveThumbKey,
    ]);
    return { ok: false, error: GENERIC_PUBLISH_ERROR };
  }

  try {
    await withRls(
      {
        userId: claims.userId,
        programRole: claims.programRole,
        adminRole: claims.adminRole,
        status: claims.status,
      },
      async (tx) => {
        await tx.resource.create({
          data: {
            id,
            title: parsed.data.title,
            previewText: parsed.data.previewText,
            thumbnailObjectKey: liveThumbKey,
            sourceLabel: parsed.data.sourceLabel,
            tags: parsed.data.tags,
            fileObjectKey: liveFileKey,
            fileSizeBytes: BigInt(scanned.fileBytes.length),
            fileMimeType: parsed.data.fileMimeType,
            visibility: parsed.data.visibility,
            uploadedBy: claims.userId,
          },
        });
        await writeAudit(tx, {
          actorUserId: claims.userId,
          actorRole: actorRole(claims),
          action: "resource_created",
          entityType: "resource",
          entityId: id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { mime: parsed.data.fileMimeType, bytes: scanned.fileBytes.length },
          severity: "info",
        });
      },
    );
  } catch {
    await deleteKeys([liveFileKey, liveThumbKey]);
    return { ok: false, error: GENERIC_PUBLISH_ERROR };
  }

  return { ok: true, id };
}

export async function replaceResource(
  session: SessionClaims | null,
  input: ReplaceInput,
): Promise<PublishResult> {
  const claims = authorizePublisher(session, input);
  const parsed = replaceSchema.safeParse({
    resourceId: input.resourceId,
    ingestId: input.ingestId,
    fileMimeType: input.fileMimeType,
    fileSizeBytes: input.fileSizeBytes,
    thumbMimeType: input.thumbMimeType,
  });
  const ingest = ingestKeys(input.ingestId);
  if (!parsed.success) {
    await deleteKeys([ingest.fileKey, ingest.thumbKey]);
    const first = parsed.error.issues[0]?.message ?? "Check the required fields.";
    return { ok: false, error: first };
  }

  const existing = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) =>
      tx.resource.findUnique({
        where: { id: parsed.data.resourceId },
        select: {
          id: true,
          deletedAt: true,
          fileObjectKey: true,
          thumbnailObjectKey: true,
        },
      }),
  );
  if (!existing || existing.deletedAt) {
    await deleteKeys([ingest.fileKey, ingest.thumbKey]);
    return { ok: false, error: GENERIC_PUBLISH_ERROR };
  }

  const scanned = await scanIngest(parsed.data.ingestId);
  if (!scanned.ok) {
    return scanned;
  }

  const newFileKey = `resources/${existing.id}/file-${parsed.data.ingestId}`;
  const newThumbKey = `resources/${existing.id}/thumb-${parsed.data.ingestId}`;
  try {
    await promoteObject(scanned.keys.fileKey, newFileKey);
    await promoteObject(scanned.keys.thumbKey, newThumbKey);
  } catch {
    await deleteKeys([
      scanned.keys.fileKey,
      scanned.keys.thumbKey,
      newFileKey,
      newThumbKey,
    ]);
    return { ok: false, error: GENERIC_PUBLISH_ERROR };
  }

  try {
    await withRls(
      {
        userId: claims.userId,
        programRole: claims.programRole,
        adminRole: claims.adminRole,
        status: claims.status,
      },
      async (tx) => {
        await tx.resource.update({
          where: { id: existing.id },
          data: {
            fileObjectKey: newFileKey,
            thumbnailObjectKey: newThumbKey,
            fileSizeBytes: BigInt(scanned.fileBytes.length),
            fileMimeType: parsed.data.fileMimeType,
          },
        });
        await writeAudit(tx, {
          actorUserId: claims.userId,
          actorRole: actorRole(claims),
          action: "resource_edited",
          entityType: "resource",
          entityId: existing.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { mime: parsed.data.fileMimeType, bytes: scanned.fileBytes.length },
          severity: "info",
        });
      },
    );
  } catch {
    await deleteKeys([newFileKey, newThumbKey]);
    return { ok: false, error: GENERIC_PUBLISH_ERROR };
  }

  await deleteKeys([existing.fileObjectKey, existing.thumbnailObjectKey]);
  return { ok: true, id: existing.id };
}
