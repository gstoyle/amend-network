import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { env } from "@/lib/env";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `forum-rls-${randomUUID()}`;

function isRlsDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /row-level security policy|permission denied|members may only edit body|authors may only delete|No record was found for an update/i.test(
    message,
  );
}

async function insertCategory(visibility: string[]): Promise<string> {
  const id = randomUUID();
  const visibilityLiteral = `{${visibility.join(",")}}`;
  await migrator.$executeRaw`
    INSERT INTO forum_categories (id, name, slug, description, visibility, sort_order)
    VALUES (
      ${id}::uuid,
      ${`${MARKER}-cat`},
      ${`${MARKER}-${id.slice(0, 8)}`},
      'RLS fixture',
      ${visibilityLiteral}::text[],
      99
    )
  `;
  return id;
}

async function insertThread(categoryId: string, authorId: string): Promise<string> {
  const id = randomUUID();
  await migrator.$executeRaw`
    INSERT INTO forum_threads (
      id, category_id, author_id, author_label, title, last_posted_at
    ) VALUES (
      ${id}::uuid,
      ${categoryId}::uuid,
      ${authorId}::uuid,
      'Ada L.',
      ${`${MARKER}-thread`},
      CURRENT_TIMESTAMP
    )
  `;
  return id;
}

async function insertPost(threadId: string, authorId: string): Promise<string> {
  const id = randomUUID();
  await migrator.$executeRaw`
    INSERT INTO forum_posts (id, thread_id, author_id, author_label, body)
    VALUES (
      ${id}::uuid,
      ${threadId}::uuid,
      ${authorId}::uuid,
      'Ada L.',
      ${`${MARKER}-body`}
    )
  `;
  return id;
}

function ctx(
  role: "super_admin" | "pathways" | "lead" | "moderator" | "pending",
  userId?: string,
) {
  const session = claimsFor(role)!;
  return {
    userId: userId ?? session.userId,
    programRole: session.programRole,
    adminRole: session.adminRole,
    status: session.status,
  };
}

describe("forum RLS", () => {
  const categoryIds: string[] = [];
  const memberIds: string[] = [];

  async function insertMember(directoryVisible: boolean): Promise<string> {
    const id = randomUUID();
    await migrator.user.create({
      data: {
        id,
        emailLookup: hmacEmailLookup(`${MARKER}-${id}@example.com`),
        emailEncrypted: encryptPii(`${MARKER}-${id}@example.com`),
        passwordHash: await hashPassword(env().SEED_PASSWORD),
        firstNameEncrypted: encryptPii("Ada"),
        lastNameEncrypted: encryptPii("Lovelace"),
        programRole: "pathways",
        adminRole: "none",
        status: "active",
        directoryVisible,
      },
    });
    memberIds.push(id);
    return id;
  }

  afterEach(async () => {
    for (const id of categoryIds.splice(0)) {
      await migrator.$executeRaw`DELETE FROM forum_flags WHERE post_id IN (
        SELECT id FROM forum_posts WHERE thread_id IN (
          SELECT id FROM forum_threads WHERE category_id = ${id}::uuid
        )
      )`;
      await migrator.$executeRaw`DELETE FROM forum_subscriptions WHERE thread_id IN (
        SELECT id FROM forum_threads WHERE category_id = ${id}::uuid
      )`;
      await migrator.$executeRaw`DELETE FROM forum_posts WHERE thread_id IN (
        SELECT id FROM forum_threads WHERE category_id = ${id}::uuid
      )`;
      await migrator.$executeRaw`DELETE FROM forum_threads WHERE category_id = ${id}::uuid`;
      await migrator.$executeRaw`DELETE FROM forum_categories WHERE id = ${id}::uuid`;
    }
    for (const id of memberIds.splice(0)) {
      await migrator.user.delete({ where: { id } });
    }
  });

  it("pathways selects all_authenticated and pathways, not lead-only", async () => {
    const shared = await insertCategory(["all_authenticated"]);
    const pathways = await insertCategory(["pathways"]);
    const lead = await insertCategory(["lead"]);
    categoryIds.push(shared, pathways, lead);
    const rows = await withRls(ctx("pathways"), (tx) =>
      tx.forumCategory.findMany({ where: { id: { in: [shared, pathways, lead] } } }),
    );
    expect(rows.map((row) => row.id).sort()).toEqual([shared, pathways].sort());
  });

  it("lead cannot select a pathways-only category", async () => {
    const pathways = await insertCategory(["pathways"]);
    categoryIds.push(pathways);
    const rows = await withRls(ctx("lead"), (tx) =>
      tx.forumCategory.findMany({ where: { id: pathways } }),
    );
    expect(rows).toEqual([]);
  });

  it("forum tables grant the migrate owner FORCE RLS access for definer helpers", async () => {
    const rows = await migrator.$queryRaw<{ table: string }[]>`
      SELECT c.relname AS table
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND pol.polname IN (
          'forum_categories_owner',
          'forum_threads_owner',
          'forum_posts_owner',
          'forum_subscriptions_owner'
        )
    `;
    expect(rows.map((row) => row.table).sort()).toEqual([
      "forum_categories",
      "forum_posts",
      "forum_subscriptions",
      "forum_threads",
    ]);
  });

  it("members cannot select a paused empty-visibility category; staff can", async () => {
    const paused = await insertCategory([]);
    categoryIds.push(paused);
    const memberRows = await withRls(ctx("pathways"), (tx) =>
      tx.forumCategory.findMany({ where: { id: paused } }),
    );
    const staffRows = await withRls(ctx("moderator"), (tx) =>
      tx.forumCategory.findMany({ where: { id: paused } }),
    );
    expect(memberRows).toEqual([]);
    expect(staffRows).toHaveLength(1);
  });

  it("staff selects every category", async () => {
    const lead = await insertCategory(["lead"]);
    categoryIds.push(lead);
    const rows = await withRls(ctx("moderator"), (tx) =>
      tx.forumCategory.findMany({ where: { id: lead } }),
    );
    expect(rows).toHaveLength(1);
  });

  it("staff without a program role can start a thread in a restricted category", async () => {
    const categoryId = await insertCategory(["lead"]);
    categoryIds.push(categoryId);
    const session = claimsFor("super_admin")!;
    const threadId = randomUUID();
    const postId = randomUUID();

    await withRls(ctx("super_admin"), async (tx) => {
      await tx.forumThread.create({
        data: {
          id: threadId,
          categoryId,
          authorId: session.userId,
          authorLabel: "Staff member",
          title: "Staff welcome",
          lastPostedAt: new Date(),
        },
      });
      await tx.forumPost.create({
        data: {
          id: postId,
          threadId,
          authorId: session.userId,
          authorLabel: "Staff member",
          body: "Welcome to the forum.",
        },
      });
    });

    await withRls(ctx("super_admin"), (tx) =>
      tx.forumThread.update({
        where: { id: threadId },
        data: { locked: true },
      }),
    );
    await expect(
      withRls(ctx("super_admin"), (tx) =>
        tx.forumPost.create({
          data: {
            id: randomUUID(),
            threadId,
            authorId: session.userId,
            authorLabel: "Staff member",
            body: "This locked thread must reject replies.",
          },
        }),
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("pending selects no categories", async () => {
    const shared = await insertCategory(["all_authenticated"]);
    categoryIds.push(shared);
    const rows = await withRls(ctx("pending"), (tx) =>
      tx.forumCategory.findMany({ where: { id: shared } }),
    );
    expect(rows).toEqual([]);
  });

  it("pathways can insert a post into a shared thread and cannot hide it", async () => {
    const categoryId = await insertCategory(["all_authenticated"]);
    categoryIds.push(categoryId);
    const authorId = await insertMember(true);
    const threadId = await insertThread(categoryId, authorId);
    const postId = randomUUID();
    await withRls(ctx("pathways", authorId), (tx) =>
      tx.forumPost.create({
        data: {
          id: postId,
          threadId,
          authorId,
          authorLabel: "Ada L.",
          body: "Hello from pathways",
        },
      }),
    );
    await expect(
      withRls(ctx("pathways", authorId), (tx) =>
        tx.forumPost.update({
          where: { id: postId },
          data: { hiddenAt: new Date() },
        }),
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("unlisted pathways cannot insert a post into a shared thread", async () => {
    const categoryId = await insertCategory(["all_authenticated"]);
    categoryIds.push(categoryId);
    const authorId = await insertMember(false);
    const threadId = await insertThread(categoryId, authorId);
    await expect(
      withRls(ctx("pathways", authorId), (tx) =>
        tx.forumPost.create({
          data: {
            id: randomUUID(),
            threadId,
            authorId,
            authorLabel: "Ada L.",
            body: "Anonymous post",
          },
        }),
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("moderator can hide a post", async () => {
    const categoryId = await insertCategory(["all_authenticated"]);
    categoryIds.push(categoryId);
    const authorId = claimsFor("pathways")!.userId;
    const threadId = await insertThread(categoryId, authorId);
    const postId = await insertPost(threadId, authorId);
    await withRls(ctx("moderator"), (tx) =>
      tx.forumPost.update({
        where: { id: postId },
        data: { hiddenAt: new Date() },
      }),
    );
    const hidden = await migrator.forumPost.findUnique({ where: { id: postId } });
    expect(hidden?.hiddenAt).not.toBeNull();
  });

  it("pathways cannot insert into a lead-only category", async () => {
    const categoryId = await insertCategory(["lead"]);
    categoryIds.push(categoryId);
    const authorId = await insertMember(true);
    await expect(
      withRls(ctx("pathways", authorId), (tx) =>
        tx.forumThread.create({
          data: {
            categoryId,
            authorId,
            authorLabel: "Ada L.",
            title: "Should not land",
            lastPostedAt: new Date(),
          },
        }),
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("the thread author can soft-delete their thread and cannot edit its title", async () => {
    const categoryId = await insertCategory(["all_authenticated"]);
    categoryIds.push(categoryId);
    const authorId = claimsFor("pathways")!.userId;
    const ownId = await insertThread(categoryId, authorId);
    const otherId = await insertThread(categoryId, randomUUID());
    await expect(
      withRls(ctx("pathways"), (tx) =>
        tx.forumThread.update({
          where: { id: ownId },
          data: { title: "rewritten" },
        }),
      ),
    ).rejects.toSatisfy(isRlsDenied);
    await withRls(ctx("pathways"), (tx) =>
      tx.forumThread.update({
        where: { id: ownId },
        data: { deletedAt: new Date(), hiddenAt: new Date() },
      }),
    );
    const own = await migrator.forumThread.findUnique({ where: { id: ownId } });
    expect(own?.deletedAt).not.toBeNull();
    await expect(
      withRls(ctx("pathways"), (tx) =>
        tx.forumThread.update({
          where: { id: otherId },
          data: { deletedAt: new Date() },
        }),
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });
});
