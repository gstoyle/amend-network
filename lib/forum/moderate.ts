import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { writeAudit } from "@/lib/audit/write";
import { withRls } from "@/lib/db/rls";
import { FORUM_STAFF_ROLES, actorRole, isForumStaff, rlsContext } from "@/lib/forum/staff";
import type { ForumWriteMeta, ForumWriteResult } from "@/lib/forum/write";

function fail(error: unknown, fallback: string): ForumWriteResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

export async function hidePost(
  session: SessionClaims | null,
  input: { postId: string } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = requireRole(session, { admin: [...FORUM_STAFF_ROLES], mfa: true });
  try {
    await withRls(rlsContext(claims), async (tx) => {
      await tx.forumPost.update({
        where: { id: input.postId },
        data: { hiddenAt: new Date() },
      });
      await tx.forumFlag.updateMany({
        where: { postId: input.postId, status: "open" },
        data: {
          status: "hidden",
          resolverId: claims.userId,
          resolvedAt: new Date(),
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "post_hidden",
        entityType: "forum_post",
        entityId: input.postId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: {},
        severity: "warning",
      });
    });
  } catch (error) {
    return fail(error, "Could not hide this post.");
  }
  return { ok: true, id: input.postId };
}

export async function deletePost(
  session: SessionClaims | null,
  input: { postId: string } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  try {
    const claims = requireRole(session, { admin: [...FORUM_STAFF_ROLES], mfa: true });
    await withRls(rlsContext(claims), async (tx) => {
      await tx.forumPost.update({
        where: { id: input.postId },
        data: { deletedAt: new Date(), hiddenAt: new Date() },
      });
      await tx.forumFlag.updateMany({
        where: { postId: input.postId, status: "open" },
        data: {
          status: "deleted",
          resolverId: claims.userId,
          resolvedAt: new Date(),
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "post_deleted",
        entityType: "forum_post",
        entityId: input.postId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: {},
        severity: "warning",
      });
    });
  } catch {
    return { ok: false, error: "Could not delete this post." };
  }
  return { ok: true, id: input.postId };
}

export async function deleteThread(
  session: SessionClaims | null,
  input: { threadId: string } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  try {
    const claims = requireRole(session);
    await withRls(rlsContext(claims), async (tx) => {
      const thread = await tx.forumThread.findUnique({
        where: { id: input.threadId },
        select: { id: true, authorId: true, deletedAt: true },
      });
      if (!thread || thread.deletedAt) {
        throw new Error("missing");
      }
      if (!isForumStaff(claims) && thread.authorId !== claims.userId) {
        throw new Error("forbidden");
      }
      const now = new Date();
      await tx.forumThread.update({
        where: { id: thread.id },
        data: { deletedAt: now, hiddenAt: now },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "thread_deleted",
        entityType: "forum_thread",
        entityId: thread.id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: {},
        severity: "warning",
      });
    });
  } catch {
    return { ok: false, error: "Could not delete this thread." };
  }
  return { ok: true, id: input.threadId };
}

export async function keepFlaggedPost(
  session: SessionClaims | null,
  input: { postId: string } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = requireRole(session, { admin: [...FORUM_STAFF_ROLES], mfa: true });
  try {
    await withRls(rlsContext(claims), async (tx) => {
      await tx.forumFlag.updateMany({
        where: { postId: input.postId, status: "open" },
        data: {
          status: "kept",
          resolverId: claims.userId,
          resolvedAt: new Date(),
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "post_flagged",
        entityType: "forum_post",
        entityId: input.postId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { resolution: "kept" },
        severity: "info",
      });
    });
  } catch (error) {
    return fail(error, "Could not resolve this flag.");
  }
  return { ok: true, id: input.postId };
}

export async function setThreadLocked(
  session: SessionClaims | null,
  input: { threadId: string; locked: boolean } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = requireRole(session, { admin: [...FORUM_STAFF_ROLES], mfa: true });
  try {
    await withRls(rlsContext(claims), async (tx) => {
      await tx.forumThread.update({
        where: { id: input.threadId },
        data: { locked: input.locked },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "thread_locked",
        entityType: "forum_thread",
        entityId: input.threadId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { locked: input.locked },
        severity: "info",
      });
    });
  } catch (error) {
    return fail(error, "Could not update this thread.");
  }
  return { ok: true, id: input.threadId };
}

export async function setThreadPinned(
  session: SessionClaims | null,
  input: { threadId: string; pinned: boolean } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = requireRole(session, { admin: [...FORUM_STAFF_ROLES], mfa: true });
  try {
    await withRls(rlsContext(claims), async (tx) => {
      await tx.forumThread.update({
        where: { id: input.threadId },
        data: { pinned: input.pinned },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "thread_pinned",
        entityType: "forum_thread",
        entityId: input.threadId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { pinned: input.pinned },
        severity: "info",
      });
    });
  } catch (error) {
    return fail(error, "Could not update this thread.");
  }
  return { ok: true, id: input.threadId };
}

export type FlagQueueItem = {
  id: string;
  postId: string;
  threadId: string;
  reason: string;
  createdAt: Date;
  excerpt: string;
};

export async function listOpenFlags(session: SessionClaims | null): Promise<FlagQueueItem[]> {
  const claims = requireRole(session, { admin: [...FORUM_STAFF_ROLES], mfa: true });
  return withRls(rlsContext(claims), async (tx) => {
    const rows = await tx.forumFlag.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "asc" },
      include: { post: { select: { id: true, threadId: true, body: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      postId: row.postId,
      threadId: row.post.threadId,
      reason: row.reason,
      createdAt: row.createdAt,
      excerpt: row.post.body.slice(0, 160),
    }));
  });
}
