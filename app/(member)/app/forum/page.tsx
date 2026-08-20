import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listForumCategories } from "@/lib/forum/list";

export default async function ForumIndexPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let categories;
  try {
    requireRole(claims);
    categories = await listForumCategories(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Discussion rooms for your programme. Posts use the same allowlisted markdown as announcements. Community guidelines apply."
        eyebrow="Community"
        title="Forum"
      />
      <p>
        <Link
          className="inline-flex min-h-touch items-center text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4"
          href="/community-guidelines"
        >
          Community guidelines
        </Link>
      </p>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories are available to you yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                className="flex min-h-touch flex-col gap-2 rounded-lg border border-border bg-card p-4 text-foreground"
                href={`/app/forum/${category.slug}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{category.name}</span>
                  <Badge plain tone={category.audience.restricted ? "support" : "neutral"}>
                    {category.audience.label}
                  </Badge>
                </span>
                <span className="text-sm text-muted-foreground">{category.description}</span>
                <span className="text-sm text-muted-foreground">
                  {category.threadCount} {category.threadCount === 1 ? "thread" : "threads"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
