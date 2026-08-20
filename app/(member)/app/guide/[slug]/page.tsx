import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuideArticleBody } from "@/components/guide-article-body";
import { PageHeader } from "@/components/page-header";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import {
  getVisibleGuideArticle,
  headingLinks,
  neighboringArticles,
  relatedArticles,
} from "@/lib/guide/catalog";

const TEXT_LINK =
  "inline-flex min-h-touch items-center text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4";

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
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

  const { slug } = await params;
  const article = getVisibleGuideArticle(authorized, slug);
  if (!article) {
    notFound();
  }

  const headings = headingLinks(article);
  const neighbors = neighboringArticles(authorized, article.slug);
  const related = relatedArticles(authorized, article);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <p>
        <Link className={TEXT_LINK} href="/app/guide">
          All topics
        </Link>
      </p>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <article className="flex flex-col gap-6 lg:col-span-8">
          <PageHeader description={article.summary} eyebrow="Member guide" title={article.title} />
          <a className="sr-only" href="#guide-article-body">
            Skip to article
          </a>
          <div id="guide-article-body">
            <GuideArticleBody blocks={article.blocks} />
          </div>
        </article>
        <aside className="flex flex-col gap-6 lg:col-span-4">
          {headings.length > 0 ? (
            <nav
              aria-label="On this page"
              className="rounded-lg border border-border bg-card p-4 lg:sticky lg:top-6"
            >
              <p className="text-sm font-medium text-foreground">On this page</p>
              <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a className={TEXT_LINK} href={`#${heading.id}`}>
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          {related.length > 0 ? (
            <section aria-labelledby="guide-related-heading">
              <h2 className="text-base font-semibold tracking-tight text-foreground" id="guide-related-heading">
                Related topics
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {related.map((entry) => (
                  <li key={entry.slug}>
                    <Link className={TEXT_LINK} href={`/app/guide/${entry.slug}`}>
                      {entry.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
      <nav aria-label="Adjacent topics" className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
        {neighbors.previous ? (
          <Link className={TEXT_LINK} href={`/app/guide/${neighbors.previous.slug}`}>
            Previous: {neighbors.previous.title}
          </Link>
        ) : (
          <span />
        )}
        {neighbors.next ? (
          <Link className={TEXT_LINK} href={`/app/guide/${neighbors.next.slug}`}>
            Next: {neighbors.next.title}
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
