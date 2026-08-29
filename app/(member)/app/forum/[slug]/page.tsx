import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ForumDeleteThreadControl } from "@/components/forum-delete-post";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getForumCategory, listForumThreads } from "@/lib/forum/list";
import { isForumStaff } from "@/lib/forum/staff";
import { cn, formatDayMonthYear } from "@/lib/utils";

export default async function ForumCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let category;
  let threads;
  let userId = "";
  let staff = false;
  try {
    const authorized = requireRole(claims);
    userId = authorized.userId;
    staff = isForumStaff(authorized);
    category = await getForumCategory(authorized, slug);
    threads = category ? await listForumThreads(authorized, slug) : [];
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!category) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <p>
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "px-0")}
          href="/app/forum"
        >
          Back to all categories
        </Link>
      </p>
      <PageHeader
        actions={
          <Link
            className={buttonVariants({ variant: "default" })}
            href={`/app/forum/${category.slug}/new`}
          >
            Start a thread
          </Link>
        }
        description={category.description}
        eyebrow="Forum"
        title={category.name}
      />
      <section aria-labelledby="forum-discussions-heading">
        <SectionHeader eyebrow="Forum" id="forum-discussions-heading" title="Discussions" />
        {threads.length === 0 ? (
          <div className={cn(cardClassName, "border-dashed p-6 text-center")}>
            <p className="text-sm text-muted-foreground">No threads in this category yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {threads.map((thread) => {
              const canDelete = staff || thread.authorId === userId;
              return (
                <li className={cn(cardClassName, "p-4 sm:p-5")} key={thread.id}>
                  <div className="flex items-start gap-3">
                    <Link
                      className="min-h-touch min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      href={`/app/forum/t/${thread.id}`}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        {thread.pinned ? <Badge tone="primary">Pinned</Badge> : null}
                        {thread.locked ? <Badge>Locked</Badge> : null}
                        <span className="font-semibold text-foreground">{thread.title}</span>
                      </span>
                      <span className="mt-2 block text-sm text-muted-foreground">
                        {thread.authorLabel} · {formatDayMonthYear(thread.lastPostedAt)} ·{" "}
                        {thread.postCount} {thread.postCount === 1 ? "post" : "posts"}
                      </span>
                    </Link>
                    {canDelete ? (
                      <ForumDeleteThreadControl
                        slug={category.slug}
                        threadId={thread.id}
                        title={thread.title}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
