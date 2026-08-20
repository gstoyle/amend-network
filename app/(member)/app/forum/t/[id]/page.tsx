import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createPostAction,
  deletePostAction,
  editPostAction,
  flagPostAction,
  hidePostAction,
  lockThreadAction,
  pinThreadAction,
  subscribeAction,
} from "@/app/(member)/app/forum/actions";
import { AnnouncementBody } from "@/components/announcement-body";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { controlClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getForumThread } from "@/lib/forum/list";
import { isForumStaff } from "@/lib/forum/staff";
import { FORUM_EDIT_WINDOW_MS } from "@/lib/forum/validate";
import { cn, formatDayMonthYear } from "@/lib/utils";

function currentTimestamp(): number {
  return Date.now();
}

export default async function ForumThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let thread;
  let staff = false;
  let userId = "";
  try {
    const authorized = requireRole(claims);
    userId = authorized.userId;
    staff = isForumStaff(authorized);
    thread = await getForumThread(authorized, id);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!thread) {
    notFound();
  }

  const now = currentTimestamp();

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <p>
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "px-0")}
          href={`/app/forum/${thread.categorySlug}`}
        >
          {thread.categoryName}
        </Link>
      </p>
      <PageHeader eyebrow="Forum" title={thread.title} />
      <div className="flex flex-wrap gap-2">
        {thread.pinned ? <Badge tone="primary">Pinned</Badge> : null}
        {thread.locked ? <Badge>Locked</Badge> : null}
        {thread.hidden ? <Badge tone="support">Hidden</Badge> : null}
      </div>
      {query.error ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error}
        </p>
      ) : null}

      <form action={subscribeAction}>
        <input name="threadId" type="hidden" value={thread.id} />
        <input name="subscribed" type="hidden" value={String(thread.subscribed)} />
        <Button type="submit" variant="outline">
          {thread.subscribed ? "Unsubscribe" : "Subscribe"}
        </Button>
      </form>

      {staff ? (
        <div className="flex flex-wrap gap-2">
          <form action={lockThreadAction}>
            <input name="threadId" type="hidden" value={thread.id} />
            <input name="locked" type="hidden" value={String(thread.locked)} />
            <Button type="submit" variant="outline">
              {thread.locked ? "Unlock" : "Lock"}
            </Button>
          </form>
          <form action={pinThreadAction}>
            <input name="threadId" type="hidden" value={thread.id} />
            <input name="pinned" type="hidden" value={String(thread.pinned)} />
            <Button type="submit" variant="outline">
              {thread.pinned ? "Unpin" : "Pin"}
            </Button>
          </form>
        </div>
      ) : null}

      <ol className="flex flex-col gap-4">
        {thread.posts.map((post) => {
          const canEdit =
            post.authorId === userId &&
            (staff || now - post.createdAt.getTime() <= FORUM_EDIT_WINDOW_MS);
          return (
            <li className="rounded-lg border border-border bg-card p-4" key={post.id}>
              <p className="text-sm text-muted-foreground">
                {post.authorLabel} · {formatDayMonthYear(post.createdAt)}
                {post.editedAt ? " · edited" : null}
                {post.hidden ? " · hidden" : null}
              </p>
              <div className="mt-2">
                <AnnouncementBody source={post.body} />
              </div>
              {canEdit ? (
                <form action={editPostAction} className="mt-4 flex flex-col gap-2">
                  <input name="threadId" type="hidden" value={thread.id} />
                  <input name="postId" type="hidden" value={post.id} />
                  <Label htmlFor={`edit-${post.id}`}>Edit</Label>
                  <textarea
                    className={controlClassName}
                    defaultValue={post.body}
                    id={`edit-${post.id}`}
                    maxLength={8000}
                    name="body"
                    required
                    rows={4}
                  />
                  <Button type="submit" variant="outline">
                    Save edit
                  </Button>
                </form>
              ) : null}
              <form action={flagPostAction} className="mt-4 flex flex-col gap-2">
                <input name="threadId" type="hidden" value={thread.id} />
                <input name="postId" type="hidden" value={post.id} />
                <Label htmlFor={`flag-${post.id}`}>Flag this post</Label>
                <textarea
                  className={controlClassName}
                  id={`flag-${post.id}`}
                  maxLength={500}
                  name="reason"
                  required
                  rows={2}
                />
                <Button type="submit" variant="outline">
                  Flag
                </Button>
              </form>
              {staff ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={hidePostAction}>
                    <input name="threadId" type="hidden" value={thread.id} />
                    <input name="postId" type="hidden" value={post.id} />
                    <Button type="submit" variant="outline">
                      Hide
                    </Button>
                  </form>
                  <form action={deletePostAction}>
                    <input name="threadId" type="hidden" value={thread.id} />
                    <input name="postId" type="hidden" value={post.id} />
                    <Button type="submit" variant="outline">
                      Delete
                    </Button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {thread.locked ? (
        <p className="text-sm text-muted-foreground">This thread is locked.</p>
      ) : (
        <form action={createPostAction} className="flex max-w-xl flex-col gap-4">
          <input name="threadId" type="hidden" value={thread.id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="reply">Reply</Label>
            <textarea
              className={controlClassName}
              id="reply"
              maxLength={8000}
              name="body"
              required
              rows={6}
            />
          </div>
          <Button type="submit">Post reply</Button>
        </form>
      )}
    </div>
  );
}
