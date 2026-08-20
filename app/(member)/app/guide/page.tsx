import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuideSearchForm } from "@/components/guide-search-form";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { cardClassName } from "@/components/ui/card";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { articlesByCategory, searchGuideArticles } from "@/lib/guide/catalog";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function GuideIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let authorized;
  try {
    authorized = requireRole(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const query = firstParam((await searchParams).q);
  const matches = searchGuideArticles(authorized, query);
  const groups = articlesByCategory(matches);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="How to use the Amend member network. Search or open a topic. Staff with an administrative role also see tools that members do not."
        eyebrow="Help"
        title="Member guide"
      />
      <GuideSearchForm query={query} />
      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">No topics match</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Try a shorter phrase, or clear the search to see every topic you can open.
          </p>
          <p className="mt-4">
            <Link
              className="inline-flex min-h-touch items-center text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4"
              href="/app/guide"
            >
              Clear search
            </Link>
          </p>
        </div>
      ) : (
        groups.map(({ articles, category }) => (
          <section aria-labelledby={`guide-${category.id}-heading`} key={category.id}>
            <SectionHeader
              eyebrow="Topics"
              id={`guide-${category.id}-heading`}
              title={category.title}
            />
            <p className="mb-4 text-sm text-muted-foreground">{category.summary}</p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    className={cn(cardClassName, "flex min-h-touch flex-col gap-2 p-4 text-foreground")}
                    href={`/app/guide/${article.slug}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{article.title}</span>
                      {article.audience === "member" ? null : (
                        <Badge plain tone="support">
                          Staff
                        </Badge>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">{article.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
