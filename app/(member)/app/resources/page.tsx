import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { ResourceFilters } from "@/components/resource-filters";
import { ResourceList } from "@/components/resource-list";
import { SectionHeader } from "@/components/section-header";
import { cardClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listVisibleFolders } from "@/lib/resources/folders";
import { buildLibraryView, listResources, parseResourceListQuery } from "@/lib/resources/list";
import { cn } from "@/lib/utils";

export default async function MemberResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    tag?: string | string[];
    source?: string | string[];
    folder?: string | string[];
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
  let folders;
  try {
    requireRole(claims);
    [resources, catalog, folders] = await Promise.all([
      listResources(claims, query),
      listResources(claims),
      listVisibleFolders(claims),
    ]);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const tags = [...new Set(catalog.flatMap((row) => row.tags))].sort();
  const filtersActive =
    Boolean(query.q) ||
    Boolean(query.source) ||
    Boolean(query.folder) ||
    (query.tags?.length ?? 0) > 0;
  const view = buildLibraryView({
    resources,
    folders,
    folderSlug: query.folder,
    source: query.source,
  });
  const emptyLibrary =
    view.sections.every((section) => section.folders.length === 0 && section.resources.length === 0);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Curriculum, practice tools, and templates. Amend materials are endorsed; member shares are not."
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

      {view.currentFolder ? (
        <nav aria-label="Folder" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link className="text-foreground underline decoration-border-strong underline-offset-4" href="/app/resources">
                Resources
              </Link>
            </li>
            {view.parentFolder ? (
              <li>
                <span aria-hidden="true">/</span>{" "}
                <Link
                  className="text-foreground underline decoration-border-strong underline-offset-4"
                  href={`/app/resources?folder=${view.parentFolder.slug}`}
                >
                  {view.parentFolder.name}
                </Link>
              </li>
            ) : null}
            <li>
              <span aria-hidden="true">/</span>{" "}
              <span className="text-foreground">{view.currentFolder.name}</span>
            </li>
          </ol>
        </nav>
      ) : null}

      {emptyLibrary ? (
        <ResourceList filtersActive={filtersActive} resources={[]} />
      ) : (
        view.sections.map((section) => (
          <section aria-labelledby={`${section.source}-resources-heading`} key={section.source}>
            <SectionHeader
              eyebrow="Library"
              id={`${section.source}-resources-heading`}
              title={section.title}
            />
            <p className="-mt-2 mb-4 text-sm text-muted-foreground">{section.description}</p>
            {section.folders.length > 0 ? (
              <ul className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {section.folders.map((folder) => (
                  <li key={folder.id}>
                    <Link
                      className={cn(
                        cardClassName,
                        "flex min-h-touch items-center gap-3 p-4 transition-shadow duration-fast ease-standard hover:shadow-md",
                      )}
                      href={`/app/resources?folder=${folder.slug}`}
                    >
                      <Icon className="size-5 shrink-0 text-primary" name="folder" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-foreground">{folder.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {folder.resourceCount} {folder.resourceCount === 1 ? "item" : "items"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {section.resources.length > 0 ? (
              <ResourceList filtersActive={filtersActive} resources={section.resources} />
            ) : null}
          </section>
        ))
      )}
    </div>
  );
}
