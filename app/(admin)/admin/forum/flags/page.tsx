import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  deleteFlaggedAction,
  hideFlaggedAction,
  keepFlagAction,
} from "@/app/(admin)/admin/forum/actions";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listOpenFlags } from "@/lib/forum/moderate";
import { FORUM_STAFF_ROLES } from "@/lib/forum/staff";
import { cn, formatDayMonthYear } from "@/lib/utils";

export default async function AdminForumFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  let flags;
  try {
    requireRole(claims, { admin: [...FORUM_STAFF_ROLES], mfa: true });
    flags = await listOpenFlags(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        actions={
          <Link className={buttonVariants({ variant: "outline" })} href="/admin/forum">
            Forum categories
          </Link>
        }
        description="Review reported posts and choose whether to keep, hide, or permanently delete them."
        eyebrow="Forum moderation"
        title="Open flags"
      />
      {query.error ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error}
        </p>
      ) : null}
      {flags.length === 0 ? (
        <section className={cn(cardClassName, "border-dashed p-6 text-center")}>
          <h2 className="font-semibold text-foreground">No open flags</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New member reports will appear here for review.
          </p>
        </section>
      ) : (
        <ul className="grid gap-4">
          {flags.map((flag) => (
            <li className={cn(cardClassName, "flex flex-col gap-4 p-4 lg:p-6")} key={flag.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  className={buttonVariants({ variant: "ghost" })}
                  href={`/app/forum/t/${flag.threadId}`}
                >
                  View discussion
                </Link>
                <p className="text-xs text-muted-foreground">
                  Reported {formatDayMonthYear(flag.createdAt)}
                </p>
              </div>
              <div>
                <p className="eyebrow text-muted-foreground">Reason</p>
                <p className="mt-1 font-medium text-foreground">{flag.reason}</p>
              </div>
              <blockquote className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {flag.excerpt}
              </blockquote>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <form action={keepFlagAction}>
                  <input name="postId" type="hidden" value={flag.postId} />
                  <Button type="submit" variant="outline">
                    Keep post
                  </Button>
                </form>
                <form action={hideFlaggedAction}>
                  <input name="postId" type="hidden" value={flag.postId} />
                  <Button type="submit" variant="secondary">
                    Hide post
                  </Button>
                </form>
                <form action={deleteFlaggedAction}>
                  <input name="postId" type="hidden" value={flag.postId} />
                  <Button type="submit" variant="destructive">
                    Delete post
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
