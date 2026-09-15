import { randomUUID } from "node:crypto";
import { track } from "@/lib/analytics/track";
import { writeAudit } from "@/lib/audit/write";
import type { SessionClaims } from "@/lib/auth/types";
import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import {
  ForumListingRequiredError,
  requireForumParticipant,
} from "@/lib/forum/access";
import { notifyThreadSubscribers } from "@/lib/forum/notify";
import { actorRole, isForumStaff, rlsContext } from "@/lib/forum/staff";
import { consumeForumQuota } from "@/lib/forum/throttle";
import {
  FORUM_EDIT_WINDOW_MS,
  FORUM_LISTING_REQUIRED_MESSAGE,
  FORUM_NAME_REQUIRED_MESSAGE,
  FORUM_RATE_LIMIT_MESSAGE,
  assertForumBody,
  assertForumReason,
  assertForumTitle,
  authorLabelFrom,
  forumErrorMessage,
  hasDisplayableForumName,
  isPausedForumCategory,
} from "@/lib/forum/validate";

export type ForumWriteResult = { ok: true; id: string } | { ok: false; error: string };

export type ForumWriteMeta = { ip: string; userAgent: string };

async function authorLabel(
  tx: Parameters<Parameters<typeof withRls>[1]>[0],
  userId: string,
): Promise<string> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { firstNameEncrypted: true, lastNameEncrypted: true },
  });
  const first = user?.firstNameEncrypted ? decryptPii(user.firstNameEncrypted) : "";
  const last = user?.lastNameEncrypted ? decryptPii(user.lastNameEncrypted) : "";
  if (!hasDisplayableForumName(first, last)) {
    throw new Error(FORUM_NAME_REQUIRED_MESSAGE);
  }
  return authorLabelFrom(first, last);
}

function asError(error: unknown, fallback: string): ForumWriteResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

async function writerClaims(
  session: SessionClaims | null,
): Promise<SessionClaims | ForumWriteResult> {
  try {
    return await requireForumParticipant(session);
  } catch (error) {
    if (error instanceof ForumListingRequiredError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

const WRITE_MESSAGES = [
  FORUM_RATE_LIMIT_MESSAGE,
  FORUM_LISTING_REQUIRED_MESSAGE,
  FORUM_NAME_REQUIRED_MESSAGE,
] as const;

export async function createThread(
  session: SessionClaims | null,
  input: { categorySlug: string; title: string; body: string } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = await writerClaims(session);
  if ("ok" in claims) {
    return claims;
  }
  let title: string;
  let body: string;
  try {
    title = assertForumTitle(input.title);
    body = assertForumBody(input.body);
  } catch (error) {
    return asError(error, "Could not start this thread.");
  }
  const id = randomUUID();
  const postId = randomUUID();
  try {
    await withRls(rlsContext(claims), async (tx) => {
      if (!isForumStaff(claims)) {
        await consumeForumQuota(tx, claims.userId, "thread");
        await consumeForumQuota(tx, claims.userId, "post");
      }
      const category = await tx.forumCategory.findUnique({
        where: { slug: input.categorySlug },
      });
      if (!category || isPausedForumCategory(category.visibility)) {
        throw new Error("That category is not available.");
      }
      const label = await authorLabel(tx, claims.userId);
      const now = new Date();
      await tx.forumThread.create({
        data: {
          id,
          categoryId: category.id,
          authorId: claims.userId,
          authorLabel: label,
          title,
          lastPostedAt: now,
        },
      });
      await tx.forumPost.create({
        data: {
          id: postId,
          threadId: id,
          authorId: claims.userId,
          authorLabel: label,
          body,
        },
      });
      await tx.forumSubscription.create({
        data: { userId: claims.userId, threadId: id },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "post_created",
        entityType: "forum_thread",
        entityId: id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { postId },
        severity: "info",
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: forumErrorMessage(error, "Could not start this thread.", [
        ...WRITE_MESSAGES,
        "That category is not available.",
      ]),
    };
  }
  track("forum_post_created", {
    distinctId: claims.userId,
    programRole: claims.programRole,
    adminRole: claims.adminRole,
    threadId: id,
    postId,
  });
  return { ok: true, id };
}

export async function createPost(
  session: SessionClaims | null,
  input: { threadId: string; body: string } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = await writerClaims(session);
  if ("ok" in claims) {
    return claims;
  }
  let body: string;
  try {
    body = assertForumBody(input.body);
  } catch (error) {
    return asError(error, "Could not post this reply.");
  }
  const id = randomUUID();
  try {
    await withRls(rlsContext(claims), async (tx) => {
      const thread = await tx.forumThread.findUnique({
        where: { id: input.threadId },
        include: { category: { select: { visibility: true } } },
      });
      if (
        !thread ||
        thread.locked ||
        isPausedForumCategory(thread.category.visibility)
      ) {
        throw new Error("This thread is locked.");
      }
      if (!isForumStaff(claims)) {
        await consumeForumQuota(tx, claims.userId, "post");
      }
      const label = await authorLabel(tx, claims.userId);
      await tx.forumPost.create({
        data: {
          id,
          threadId: input.threadId,
          authorId: claims.userId,
          authorLabel: label,
          body,
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "post_created",
        entityType: "forum_post",
        entityId: id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { threadId: input.threadId },
        severity: "info",
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: forumErrorMessage(error, "Could not post this reply.", [
        ...WRITE_MESSAGES,
        "This thread is locked.",
      ]),
    };
  }
  track("forum_post_created", {
    distinctId: claims.userId,
    programRole: claims.programRole,
    adminRole: claims.adminRole,
    threadId: input.threadId,
    postId: id,
  });
  void notifyThreadSubscribers(claims, input.threadId);
  return { ok: true, id };
}

export async function editPost(
  session: SessionClaims | null,
  input: { postId: string; body: string } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = await writerClaims(session);
  if ("ok" in claims) {
    return claims;
  }
  let body: string;
  try {
    body = assertForumBody(input.body);
  } catch (error) {
    return asError(error, "Could not save this edit.");
  }
  try {
    await withRls(rlsContext(claims), async (tx) => {
      const post = await tx.forumPost.findUnique({ where: { id: input.postId } });
      if (!post || post.authorId !== claims.userId) {
        throw new Error("Could not save this edit.");
      }
      if (Date.now() - post.createdAt.getTime() > FORUM_EDIT_WINDOW_MS && !isForumStaff(claims)) {
        throw new Error("Edits are only allowed for 15 minutes.");
      }
      await tx.forumPost.update({
        where: { id: input.postId },
        data: { body, editedAt: new Date() },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "post_edited",
        entityType: "forum_post",
        entityId: input.postId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: {},
        severity: "info",
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: forumErrorMessage(error, "Could not save this edit.", [
        FORUM_LISTING_REQUIRED_MESSAGE,
        "Edits are only allowed for 15 minutes.",
      ]),
    };
  }
  return { ok: true, id: input.postId };
}

export async function flagPost(
  session: SessionClaims | null,
  input: { postId: string; reason: string } & ForumWriteMeta,
): Promise<ForumWriteResult> {
  const claims = await writerClaims(session);
  if ("ok" in claims) {
    return claims;
  }
  let reason: string;
  try {
    reason = assertForumReason(input.reason);
  } catch (error) {
    return asError(error, "Could not flag this post.");
  }
  const id = randomUUID();
  try {
    await withRls(rlsContext(claims), async (tx) => {
      const existing = await tx.forumFlag.findFirst({
        where: { postId: input.postId, reporterId: claims.userId, status: "open" },
      });
      if (existing) {
        return;
      }
      await tx.forumFlag.create({
        data: {
          id,
          postId: input.postId,
          reporterId: claims.userId,
          reason,
          status: "open",
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
        metadata: { flagId: id },
        severity: "warning",
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: forumErrorMessage(error, "Could not flag this post.", [
        FORUM_LISTING_REQUIRED_MESSAGE,
      ]),
    };
  }
  track("forum_post_flagged", {
    distinctId: claims.userId,
    programRole: claims.programRole,
    adminRole: claims.adminRole,
    postId: input.postId,
  });
  return { ok: true, id };
}
