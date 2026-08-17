import { track } from "@/lib/analytics/track";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { visibilityTokens } from "@/lib/db/visibility";
import { presignGet } from "@/lib/storage/client";

const THUMBNAIL_EXPIRES_SECONDS = 120;
const SOURCE_LABELS = ["Amend", "Partner Org", "External"] as const;
const RESOURCE_SORTS = ["newest", "downloads", "title"] as const;

export type ResourceSort = (typeof RESOURCE_SORTS)[number];
export type ResourceSource = (typeof SOURCE_LABELS)[number];

export type ResourceListQuery = {
  q?: string;
  tags?: string[];
  source?: string;
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
  updatedAt: Date;
  thumbnailHref: string;
  fileMimeType: string;
  playbackHref: string | null;
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

function isSourceLabel(value: string): value is ResourceSource {
  return (SOURCE_LABELS as readonly string[]).includes(value);
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
  sort?: string | string[];
}): ResourceListQuery {
  const q = firstParam(input.q)?.trim();
  const tagRaw = input.tag;
  const tags = (Array.isArray(tagRaw) ? tagRaw : tagRaw ? [tagRaw] : [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const sourceRaw = firstParam(input.source)?.trim() ?? "";
  const sortRaw = firstParam(input.sort) ?? "newest";
  return {
    ...(q ? { q } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(isSourceLabel(sourceRaw) ? { source: sourceRaw } : {}),
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
  updatedAt: Date;
  fileMimeType: string;
}): MemberResource {
  const isVideo = row.fileMimeType === "video/mp4";
  return {
    id: row.id,
    title: row.title,
    previewText: row.previewText,
    sourceLabel: row.sourceLabel,
    tags: row.tags,
    updatedAt: row.updatedAt,
    thumbnailHref: `/app/resources/${row.id}/thumbnail`,
    fileMimeType: row.fileMimeType,
    playbackHref: isVideo ? `/app/resources/${row.id}/file` : null,
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

  const keyword = query.q?.trim();
  if (keyword) {
    const escaped = escapeIlike(keyword);
    where.OR = [
      { title: { contains: escaped, mode: "insensitive" } },
      { previewText: { contains: escaped, mode: "insensitive" } },
    ];
  }
  if (query.tags && query.tags.length > 0) {
    where.tags = { hasEvery: query.tags };
  }
  if (query.source && isSourceLabel(query.source)) {
    where.sourceLabel = query.source;
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
          updatedAt: true,
          thumbnailObjectKey: true,
          fileMimeType: true,
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
