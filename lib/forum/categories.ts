import { randomUUID } from "node:crypto";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { parseVisibility } from "@/lib/announcements/validate";
import {
  FORUM_CATEGORY_ADMIN_ROLES,
  actorRole,
  rlsContext,
} from "@/lib/forum/staff";
import {
  assertCategoryDescription,
  assertCategoryName,
  assertCategorySlug,
} from "@/lib/forum/validate";
import type { ForumWriteMeta, ForumWriteResult } from "@/lib/forum/write";

function fail(error: unknown, fallback: string): ForumWriteResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

export async function createForumCategory(
  session: SessionClaims | null,
  input: {
    name: string;
    slug: string;
    description: string;
    visibility: string[];
  } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = requireRole(session, {
    admin: [...FORUM_CATEGORY_ADMIN_ROLES],
    mfa: true,
  });
  let name: string;
  let slug: string;
  let description: string;
  let visibility: string[];
  try {
    name = assertCategoryName(input.name);
    slug = assertCategorySlug(input.slug);
    description = assertCategoryDescription(input.description);
    visibility = parseVisibility(input.visibility);
  } catch (error) {
    return fail(error, "Could not save this category.");
  }
  const id = randomUUID();
  try {
    await withRls(rlsContext(claims), async (tx) => {
      const last = await tx.forumCategory.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      await tx.forumCategory.create({
        data: {
          id,
          name,
          slug,
          description,
          visibility,
          sortOrder: (last?.sortOrder ?? 0) + 10,
          createdBy: claims.userId,
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "system_setting_changed",
        entityType: "forum_category",
        entityId: id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { slug },
        severity: "info",
      });
    });
  } catch (error) {
    return fail(error, "Could not save this category.");
  }
  return { ok: true, id };
}

export async function listAdminCategories(session: SessionClaims | null) {
  const claims = requireRole(session, {
    admin: [...FORUM_CATEGORY_ADMIN_ROLES],
    mfa: true,
  });
  return withRls(rlsContext(claims), (tx) =>
    tx.forumCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  );
}
