import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createPostAction,
  editPostAction,
  lockThreadAction,
  pinThreadAction,
  subscribeAction,
} from "@/app/(member)/app/forum/actions";
import { AnnouncementBody } from "@/components/announcement-body";
import { ForumDeletePostControl, ForumDeleteThreadControl } from "@/components/forum-delete-post";
import { MemberInitials } from "@/components/member-initials";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  cardClassName,
  formFieldClassName,
  formInsetClassName,
  formSurfaceClassName,
} from "@/components/ui/card";
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

function initialsFromAuthorLabel(label: string): string {
  const [first = "", second = ""] = label.trim().split(/\s+/);
  const letters = `${first.charAt(0)}${second.replaceAll(".", "").charAt(0)}`.toUpperCase();
  return letters || "—";
}

const disclosureSummaryClassName = cn(
  buttonVariants({ variant: "ghost" }),
  "cursor-pointer list-none group-open:bg-muted [&::-webkit-details-marker]:hidden",
);

function ActionDisclosure({
  children,
  label,
  name,
}: {
  children: ReactNode;
  label: string;
  name: string;
}) {
  return (
    <details className="group w-full min-w-0">
      <summary aria-label={name} className={disclosureSummaryClassName}>
        {label}
      </summary>
      <div className={cn(formInsetClassName, "mt-2 w-full")}>{children}</div>
    </details>
  );
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
      <PageHeader
        actions={
          <>
            {thread.pinned ? <Badge tone="primary">Pinned</Badge> : null}
            {thread.locked ? <Badge>Locked</Badge> : null}
            {thread.hidden ? <Badge tone="support">Hidden</Badge> : null}
            <form action={subscribeAction}>
              <input name="threadId" type="hidden" value={thread.id} />
              <input name="subscribed" type="hidden" value={String(thread.subscribed)} />
              <Button type="submit" variant="outline">
                {thread.subscribed ? "Unsubscribe" : "Subscribe"}
              </Button>
            </form>
            {staff ? (
              <>
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
              </>
            ) : null}
            {staff || thread.authorId === userId ? (
              <ForumDeleteThreadControl
                slug={thread.categorySlug}
                threadId={thread.id}
                title={thread.title}
              />
            ) : null}
          </>
        }
        eyebrow="Forum"
        title={thread.title}
      />
      {query.error ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error}
        </p>
      ) : null}

      <ol className="flex flex-col gap-3">
        {thread.posts.length === 0 ? (
          <li className={cn(cardClassName, "border-dashed p-6 text-center text-sm text-muted-foreground")}>
            No posts remain in this discussion.
          </li>
        ) : null}
        {thread.posts.map((post) => {
          const canEdit =
            post.authorId === userId &&
            (staff || now - post.createdAt.getTime() <= FORUM_EDIT_WINDOW_MS);
          return (
            <li className={cn(cardClassName, "p-4 sm:p-5")} key={post.id}>
              <div className="flex items-start gap-3">
                <MemberInitials initials={initialsFromAuthorLabel(post.authorLabel)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{post.authorLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDayMonthYear(post.createdAt)}
                    {post.editedAt ? " · edited" : null}
                    {post.hidden ? " · hidden" : null}
                  </p>
                </div>
                {staff ? (
                  <ForumDeletePostControl
                    authorLabel={post.authorLabel}
                    postId={post.id}
                    threadId={thread.id}
                  />
                ) : null}
              </div>
              <div className="mt-4">
                <AnnouncementBody source={post.body} />
              </div>
              {canEdit ? (
                <div className="mt-4 w-full min-w-0 border-t border-border pt-3">
                  <ActionDisclosure
                    label="Edit"
                    name={`Edit post by ${post.authorLabel}`}
                  >
                    <form action={editPostAction} className="flex w-full min-w-0 flex-col gap-3">
                      <input name="threadId" type="hidden" value={thread.id} />
                      <input name="postId" type="hidden" value={post.id} />
                      <div className={cn(formFieldClassName, "w-full")}>
                        <Label htmlFor={`edit-${post.id}`}>Body</Label>
                        <textarea
                          className={controlClassName}
                          defaultValue={post.body}
                          id={`edit-${post.id}`}
                          maxLength={8000}
                          name="body"
                          required
                          rows={4}
                        />
                      </div>
                      <Button className="self-start" type="submit" variant="outline">
                        Save edit
                      </Button>
                    </form>
                  </ActionDisclosure>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {thread.locked ? (
        <p className={cn(formInsetClassName, "text-sm text-muted-foreground")}>
          This thread is locked. New replies are closed.
        </p>
      ) : (
        <form
          action={createPostAction}
          aria-labelledby="forum-reply-heading"
          className={cn(formSurfaceClassName, "flex flex-col gap-4")}
        >
          <input name="threadId" type="hidden" value={thread.id} />
          <h2 className="text-base font-semibold text-foreground" id="forum-reply-heading">
            Reply
          </h2>
          <div className={formFieldClassName}>
            <Label htmlFor="reply">Message</Label>
            <textarea
              className={controlClassName}
              id="reply"
              maxLength={8000}
              name="body"
              required
              rows={5}
            />
          </div>
          <Button className="self-start" type="submit">
            Post reply
          </Button>
        </form>
      )}
    </div>
  );
}
