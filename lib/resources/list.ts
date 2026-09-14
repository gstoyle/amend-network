import { track } from "@/lib/analytics/track";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { type AudienceMarker, audienceLabel, visibilityTokens } from "@/lib/db/visibility";
import type { ResourceFolderListItem } from "@/lib/resources/folders";
import {
  RESOURCE_SOURCE_COPY,
  RESOURCE_SOURCES,
  type ResourceSource,
  isResourceSource,
} from "@/lib/resources/labels";
import { presignGet } from "@/lib/storage/client";

const THUMBNAIL_EXPIRES_SECONDS = 120;
const RESOURCE_SORTS = ["newest", "downloads", "title"] as const;
const KIB = 1024;

export type ResourceSort = (typeof RESOURCE_SORTS)[number];
export type { ResourceSource };
export type ResourceFormat = "PDF" | "Video" | "Slides" | "Template" | "Toolkit";

const FORMAT_BY_MIME_TYPE: Record<string, ResourceFormat> = {
  "application/pdf": "PDF",
  "video/mp4": "Video",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "Slides",
  "application/vnd.ms-powerpoint": "Slides",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Template",
  "application/msword": "Template",
  "text/markdown": "Template",
  "application/zip": "Toolkit",
};

/** An unrecognised type yields null so the card omits the format entirely. */
export function resourceFormatLabel(mimeType: string): ResourceFormat | null {
  const essence = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return FORMAT_BY_MIME_TYPE[essence] ?? null;
}

function oneDecimal(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${unit}`;
}

/**
 * Converts the stored BigInt once, here, because a BigInt cannot cross the
 * server-to-component boundary.
 */
export function resourceSizeLabel(bytes: bigint | number | null | undefined): string | null {
  if (bytes === null || bytes === undefined) {
    return null;
  }
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }
  if (size < KIB) {
    return `${size} ${size === 1 ? "byte" : "bytes"}`;
  }
  if (size < KIB ** 2) {
    return `${Math.round(size / KIB)} KB`;
  }
  if (size < KIB ** 3) {
    return oneDecimal(size / KIB ** 2, "MB");
  }
  return oneDecimal(size / KIB ** 3, "GB");
}

export type ResourceListQuery = {
  q?: string;
  tags?: string[];
  source?: ResourceSource;
  folder?: string;
  sort?: ResourceSort;
  clientProgramRole?: unknown;
  clientAdminRole?: unknown;
};

export type MemberResource = {
  id: string;
  title: string;
  previewText: string;
  sourceLabel: string;
  tags: string[];
  folderId: string | null;
  folderName: string | null;
  folderSlug: string | null;
  updatedAt: Date;
  thumbnailHref: string;
  fileMimeType: string;
  playbackHref: string | null;
  formatLabel: ResourceFormat | null;
  sizeLabel: string | null;
  audience: AudienceMarker;
};

function authorizeMember(
  session: SessionClaims | null,
  options: { clientProgramRole?: unknown; clientAdminRole?: unknown } = {},
): SessionClaims {
  return requireRole(session, {
    clientProgramRole: options.clientProgramRole,
    clientAdminRole: options.clientAdminRole,
  });
}

export function escapeIlike(term: string): string {
  return term.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function isResourceSort(value: string): value is ResourceSort {
  return (RESOURCE_SORTS as readonly string[]).includes(value);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function parseResourceListQuery(input: {
  q?: string | string[];
  tag?: string | string[];
  source?: string | string[];
  folder?: string | string[];
  sort?: string | string[];
}): ResourceListQuery {
  const q = firstParam(input.q)?.trim();
  const tagRaw = input.tag;
  const tags = (Array.isArray(tagRaw) ? tagRaw : tagRaw ? [tagRaw] : [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const sourceRaw = firstParam(input.source)?.trim() ?? "";
  const folderRaw = firstParam(input.folder)?.trim() ?? "";
  const sortRaw = firstParam(input.sort) ?? "newest";
  const folderOk = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(folderRaw);
  return {
    ...(q ? { q } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(isResourceSource(sourceRaw) ? { source: sourceRaw } : {}),
    ...(folderOk ? { folder: folderRaw } : {}),
    sort: isResourceSort(sortRaw) ? sortRaw : "newest",
  };
}

function listOrderBy(sort: ResourceSort): Prisma.ResourceOrderByWithRelationInput {
  switch (sort) {
    case "newest":
      return { createdAt: "desc" };
    case "downloads":
      return { downloadCount: "desc" };
    case "title":
      return { title: "asc" };
    default: {
      const exhaustive: never = sort;
      return exhaustive;
    }
  }
}

function toMemberResource(row: {
  id: string;
  title: string;
  previewText: string;
  sourceLabel: string;
  tags: string[];
  folderId: string | null;
  folder: { name: string; slug: string } | null;
  updatedAt: Date;
  fileMimeType: string;
  fileSizeBytes: bigint;
  visibility: string[];
}): MemberResource {
  const isVideo = row.fileMimeType === "video/mp4";
  return {
    id: row.id,
    title: row.title,
    previewText: row.previewText,
    sourceLabel: row.sourceLabel,
    tags: row.tags,
    folderId: row.folderId,
    folderName: row.folder?.name ?? null,
    folderSlug: row.folder?.slug ?? null,
    updatedAt: row.updatedAt,
    thumbnailHref: `/app/resources/${row.id}/thumbnail`,
    fileMimeType: row.fileMimeType,
    playbackHref: isVideo ? `/app/resources/${row.id}/file` : null,
    formatLabel: resourceFormatLabel(row.fileMimeType),
    sizeLabel: resourceSizeLabel(row.fileSizeBytes),
    audience: audienceLabel(row.visibility),
  };
}

async function loadLiveVisible(
  claims: SessionClaims,
  extraWhere: { id?: string },
  query: ResourceListQuery = {},
) {
  const tokens = visibilityTokens(claims);
  if (tokens.length === 0) {
    return [];
  }

  const where: Prisma.ResourceWhereInput = {
    deletedAt: null,
    visibility: { hasSome: tokens },
    ...(extraWhere.id ? { id: extraWhere.id } : {}),
  };

  const and: Prisma.ResourceWhereInput[] = [];
  const keyword = query.q?.trim();
  if (keyword) {
    const escaped = escapeIlike(keyword);
    and.push({
      OR: [
        { title: { contains: escaped, mode: "insensitive" } },
        { previewText: { contains: escaped, mode: "insensitive" } },
      ],
    });
  }
  if (query.tags && query.tags.length > 0) {
    where.tags = { hasEvery: query.tags };
  }
  if (query.source && isResourceSource(query.source)) {
    where.sourceLabel = query.source;
  }
  if (query.folder) {
    and.push({
      OR: [
        { folder: { slug: query.folder } },
        { folder: { parent: { slug: query.folder } } },
      ],
    });
  }
  if (and.length > 0) {
    where.AND = and;
  }

  const sort = extraWhere.id ? "newest" : (query.sort ?? "newest");

  return withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) =>
      tx.resource.findMany({
        where,
        orderBy: listOrderBy(sort),
        select: {
          id: true,
          title: true,
          previewText: true,
          sourceLabel: true,
          tags: true,
          folderId: true,
          folder: { select: { name: true, slug: true } },
          updatedAt: true,
          thumbnailObjectKey: true,
          fileMimeType: true,
          fileSizeBytes: true,
          visibility: true,
        },
      }),
  );
}

export async function listResources(
  session: SessionClaims | null,
  options: ResourceListQuery = {},
): Promise<MemberResource[]> {
  const claims = authorizeMember(session, options);
  const rows = await loadLiveVisible(claims, {}, options);
  return rows.map(toMemberResource);
}

export async function getResource(
  session: SessionClaims | null,
  id: string,
  options: { clientProgramRole?: unknown; clientAdminRole?: unknown } = {},
): Promise<MemberResource | null> {
  const claims = authorizeMember(session, options);
  const rows = await loadLiveVisible(claims, { id });
  const row = rows[0];
  if (!row) {
    return null;
  }
  track("resource_viewed", {
    distinctId: claims.userId,
    programRole: claims.programRole,
    adminRole: claims.adminRole,
  });
  return toMemberResource(row);
}

export async function grantThumbnail(
  session: SessionClaims | null,
  id: string,
  options: { clientProgramRole?: unknown; clientAdminRole?: unknown } = {},
): Promise<string | null> {
  const claims = authorizeMember(session, options);
  const rows = await loadLiveVisible(claims, { id });
  const row = rows[0];
  if (!row) {
    return null;
  }
  return presignGet(row.thumbnailObjectKey, THUMBNAIL_EXPIRES_SECONDS);
}

export type LibraryFolderLink = {
  id: string;
  name: string;
  slug: string;
  resourceCount: number;
};

export type LibrarySection = {
  source: ResourceSource;
  title: string;
  description: string;
  folders: LibraryFolderLink[];
  resources: MemberResource[];
};

export type LibraryView = {
  currentFolder: ResourceFolderListItem | null;
  parentFolder: ResourceFolderListItem | null;
  sections: LibrarySection[];
};

function countInTree(
  folderId: string,
  source: ResourceSource,
  folders: ResourceFolderListItem[],
  resources: MemberResource[],
): number {
  const childIds = new Set(
    folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id),
  );
  return resources.filter(
    (resource) =>
      resource.sourceLabel === source &&
      (resource.folderId === folderId || (resource.folderId && childIds.has(resource.folderId))),
  ).length;
}

export function buildLibraryView(input: {
  resources: MemberResource[];
  folders: ResourceFolderListItem[];
  folderSlug?: string;
  source?: ResourceSource;
}): LibraryView {
  const currentFolder = input.folderSlug
    ? (input.folders.find((folder) => folder.slug === input.folderSlug) ?? null)
    : null;
  const parentFolder = currentFolder?.parentId
    ? (input.folders.find((folder) => folder.id === currentFolder.parentId) ?? null)
    : null;
  const sources: ResourceSource[] = input.source ? [input.source] : [...RESOURCE_SOURCES];
  const browse = currentFolder
    ? input.folders.filter((folder) => folder.parentId === currentFolder.id)
    : input.folders.filter((folder) => folder.parentId === null);

  const sections = sources
    .map((source) => {
      const copy = RESOURCE_SOURCE_COPY[source];
      const folders = browse
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          slug: folder.slug,
          resourceCount: countInTree(folder.id, source, input.folders, input.resources),
        }))
        .filter((folder) => folder.resourceCount > 0);
      const resources = input.resources.filter((resource) => {
        if (resource.sourceLabel !== source) {
          return false;
        }
        if (currentFolder) {
          return resource.folderId === currentFolder.id;
        }
        return !resource.folderId;
      });
      return {
        source,
        title: copy.sectionTitle,
        description: copy.sectionDescription,
        folders,
        resources,
      };
    })
    .filter(
      (section) =>
        section.folders.length > 0 || section.resources.length > 0 || Boolean(input.source),
    );

  return { currentFolder, parentFolder, sections };
}
