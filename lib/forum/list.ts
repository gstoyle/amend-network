import { track } from "@/lib/analytics/track";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { type AudienceMarker, audienceLabel } from "@/lib/db/visibility";
import { isForumStaff, rlsContext } from "@/lib/forum/staff";

export type ForumCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  audience: AudienceMarker;
  threadCount: number;
};

export type ForumThreadListItem = {
  id: string;
  title: string;
  authorLabel: string;
  lastPostedAt: Date;
  postCount: number;
  pinned: boolean;
  locked: boolean;
};

export type ForumPostView = {
  id: string;
  authorLabel: string;
  authorId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  hidden: boolean;
};

export type ForumThreadView = {
  id: string;
  title: string;
  categoryName: string;
  categorySlug: string;
  locked: boolean;
  pinned: boolean;
  hidden: boolean;
  subscribed: boolean;
  posts: ForumPostView[];
};

export type ForumActivityItem = {
  id: string;
  title: string;
  categoryName: string;
  categorySlug: string;
  lastPostedAt: Date;
  authorLabel: string;
};

export async function listForumCategories(
  session: SessionClaims | null,
): Promise<ForumCategoryListItem[]> {
  const claims = requireRole(session);
  return withRls(rlsContext(claims), async (tx) => {
    const rows = await tx.forumCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { threads: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      audience: audienceLabel(row.visibility),
      threadCount: row._count.threads,
    }));
  });
}

export async function getForumCategory(
  session: SessionClaims | null,
  slug: string,
): Promise<{ id: string; name: string; slug: string; description: string } | null> {
  const claims = requireRole(session);
  return withRls(rlsContext(claims), async (tx) => {
    const row = await tx.forumCategory.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, description: true },
    });
    return row;
  });
}

export async function listForumThreads(
  session: SessionClaims | null,
  slug: string,
): Promise<ForumThreadListItem[]> {
  const claims = requireRole(session);
  return withRls(rlsContext(claims), async (tx) => {
    const category = await tx.forumCategory.findUnique({ where: { slug } });
    if (!category) {
      return [];
    }
    const rows = await tx.forumThread.findMany({
      where: { categoryId: category.id, deletedAt: null },
      orderBy: [{ pinned: "desc" }, { lastPostedAt: "desc" }],
      include: { _count: { select: { posts: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      authorLabel: row.authorLabel,
      lastPostedAt: row.lastPostedAt,
      postCount: row._count.posts,
      pinned: row.pinned,
      locked: row.locked,
    }));
  });
}

export async function getForumThread(
  session: SessionClaims | null,
  id: string,
  options?: { trackView?: boolean },
): Promise<ForumThreadView | null> {
  const claims = requireRole(session);
  const staff = isForumStaff(claims);
  const thread = await withRls(rlsContext(claims), async (tx) => {
    const row = await tx.forumThread.findUnique({
      where: { id },
      include: {
        category: { select: { name: true, slug: true } },
        posts: { orderBy: { createdAt: "asc" } },
        subscriptions: { where: { userId: claims.userId }, select: { userId: true } },
      },
    });
    if (!row || row.deletedAt) {
      return null;
    }
    if (!staff && row.hiddenAt) {
      return null;
    }
    const posts = row.posts
      .filter((post) => !post.deletedAt && (staff || !post.hiddenAt))
      .map((post) => ({
        id: post.id,
        authorLabel: post.authorLabel,
        authorId: post.authorId,
        body: post.body,
        createdAt: post.createdAt,
        editedAt: post.editedAt,
        hidden: Boolean(post.hiddenAt || post.deletedAt),
      }));
    return {
      id: row.id,
      title: row.title,
      categoryName: row.category.name,
      categorySlug: row.category.slug,
      locked: row.locked,
      pinned: row.pinned,
      hidden: Boolean(row.hiddenAt),
      subscribed: row.subscriptions.length > 0,
      posts,
    };
  });
  if (thread && options?.trackView !== false) {
    track("forum_thread_viewed", {
      distinctId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      threadId: thread.id,
    });
  }
  return thread;
}

export async function listRecentForumActivity(
  session: SessionClaims | null,
  limit = 5,
): Promise<ForumActivityItem[]> {
  const claims = requireRole(session);
  return withRls(rlsContext(claims), async (tx) => {
    const rows = await tx.forumThread.findMany({
      where: { deletedAt: null, hiddenAt: null },
      orderBy: { lastPostedAt: "desc" },
      take: limit,
      include: { category: { select: { name: true, slug: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      categoryName: row.category.name,
      categorySlug: row.category.slug,
      lastPostedAt: row.lastPostedAt,
      authorLabel: row.authorLabel,
    }));
  });
}
