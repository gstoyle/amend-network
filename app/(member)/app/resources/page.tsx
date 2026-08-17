import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Resources</h1>
      <p>
        <Link className="text-foreground underline" href="/app">
          Home
        </Link>
      </p>
      <ResourceFilters query={query} tags={tags} />
      <ResourceList resources={resources} />
    </div>
  );
}
