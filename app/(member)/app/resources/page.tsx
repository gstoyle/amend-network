import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { ResourceFilters } from "@/components/resource-filters";
import { ResourceList } from "@/components/resource-list";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listResources, parseResourceListQuery } from "@/lib/resources/list";

export default async function MemberResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    tag?: string | string[];
    source?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  const query = parseResourceListQuery(await searchParams);
  let resources;
  let catalog;
  try {
    requireRole(claims);
    [resources, catalog] = await Promise.all([
      listResources(claims, query),
      listResources(claims),
    ]);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const tags = [...new Set(catalog.flatMap((row) => row.tags))].sort();
  const filtersActive =
    Boolean(query.q) || Boolean(query.source) || (query.tags?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Curriculum, practice tools, and templates. Each item shows who it is available to."
        eyebrow="Library"
        title="Resources"
      />

      <ResourceFilters query={query} tags={tags} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {resources.length} of {catalog.length} resources
        </p>
        {filtersActive ? (
          <Link
            className="inline-flex min-h-touch items-center rounded-sm px-2 text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4"
            href="/app/resources"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      <ResourceList filtersActive={filtersActive} resources={resources} />
    </div>
  );
}
