import { randomUUID } from "node:crypto";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

const ADMIN_ROLES = ["admin", "super_admin"] as const;

export type ResourceFolderListItem = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  parentSlug: string | null;
  sortOrder: number;
};

export type FolderWriteResult = { ok: true; id: string } | { ok: false; error: string };

function rlsContext(claims: SessionClaims) {
  return {
    userId: claims.userId,
    programRole: claims.programRole,
    adminRole: claims.adminRole,
    status: claims.status,
  };
}

function actorRole(claims: SessionClaims): string {
  return claims.adminRole !== "none" ? claims.adminRole : claims.programRole;
}

function assertFolderName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    return "";
  }
  return trimmed;
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapFolder(row: {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  parent: { name: string; slug: string } | null;
}): ResourceFolderListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    parentName: row.parent?.name ?? null,
    parentSlug: row.parent?.slug ?? null,
    sortOrder: row.sortOrder,
  };
}

export async function listAdminFolders(
  session: SessionClaims | null,
): Promise<ResourceFolderListItem[]> {
  const claims = requireRole(session, { admin: [...ADMIN_ROLES], mfa: true });
  return withRls(rlsContext(claims), async (tx) => {
    const rows = await tx.resourceFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { parent: { select: { name: true, slug: true } } },
    });
    return rows.map(mapFolder);
  });
}

export async function listVisibleFolders(
  session: SessionClaims | null,
): Promise<ResourceFolderListItem[]> {
  const claims = requireRole(session);
  return withRls(rlsContext(claims), async (tx) => {
    const rows = await tx.resourceFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { parent: { select: { name: true, slug: true } } },
    });
    return rows.map(mapFolder);
  });
}

export async function createResourceFolder(
  session: SessionClaims | null,
  input: { name: string; parentId: string; ip: string; userAgent: string },
): Promise<FolderWriteResult> {
  const claims = requireRole(session, { admin: [...ADMIN_ROLES], mfa: true });
  const name = assertFolderName(input.name);
  if (!name) {
    return { ok: false, error: "Name must be 1 to 80 characters." };
  }
  const slug = slugFromName(name);
  if (!slug) {
    return { ok: false, error: "Use a name with letters or numbers." };
  }
  const parentId = input.parentId.trim() || null;
  const id = randomUUID();
  try {
    await withRls(rlsContext(claims), async (tx) => {
      if (parentId) {
        const parent = await tx.resourceFolder.findUnique({
          where: { id: parentId },
          select: { id: true, parentId: true },
        });
        if (!parent || parent.parentId) {
          throw new Error("Choose a top-level folder, or none.");
        }
      }
      const last = await tx.resourceFolder.findFirst({
        where: { parentId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      await tx.resourceFolder.create({
        data: {
          id,
          name,
          slug,
          parentId,
          sortOrder: (last?.sortOrder ?? 0) + 10,
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "system_setting_changed",
        entityType: "resource_folder",
        entityId: id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { slug },
        severity: "info",
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Choose a top-level folder, or none.") {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Could not save this folder." };
  }
  return { ok: true, id };
}
