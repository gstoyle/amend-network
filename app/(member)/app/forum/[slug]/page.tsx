import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getForumCategory, listForumThreads } from "@/lib/forum/list";
import { formatDayMonthYear } from "@/lib/utils";

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
  try {
    requireRole(claims);
    category = await getForumCategory(claims, slug);
    threads = category ? await listForumThreads(claims, slug) : [];
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
          className="inline-flex min-h-touch items-center text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4"
          href="/app/forum"
        >
          All categories
        </Link>
      </p>
      <PageHeader description={category.description} eyebrow="Forum" title={category.name} />
      <p>
        <Link
          className="inline-flex min-h-touch items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          href={`/app/forum/${category.slug}/new`}
        >
          Start a thread
        </Link>
      </p>
      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No threads in this category yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                className="flex min-h-touch flex-col gap-1 rounded-lg border border-border bg-card p-4 text-foreground"
                href={`/app/forum/t/${thread.id}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  {thread.pinned ? <Badge tone="primary">Pinned</Badge> : null}
                  {thread.locked ? <Badge>Locked</Badge> : null}
                  <span className="font-medium">{thread.title}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {thread.authorLabel} · {formatDayMonthYear(thread.lastPostedAt)} ·{" "}
                  {thread.postCount} {thread.postCount === 1 ? "post" : "posts"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
