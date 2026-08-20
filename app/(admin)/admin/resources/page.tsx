import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { audienceLabel } from "@/lib/db/visibility";
import { listAdminResources } from "@/lib/resources/publish";
import { cn } from "@/lib/utils";

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

export default async function AdminResourcesPage() {
  const claims = await loadClaims();
  let items;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    items = await listAdminResources(claims);
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
          <Link className={buttonVariants()} href="/admin/resources/new">
            Publish a resource
          </Link>
        }
        description="Manage the files and media available in the member library."
        eyebrow="Administration"
        title="Resources"
      />
      {items.length === 0 ? (
        <section className={cn(cardClassName, "border-dashed p-6 text-center")}>
          <h2 className="font-semibold text-foreground">No resources yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish the first resource to make it available to members.
          </p>
          <Link className={cn(buttonVariants(), "mt-4")} href="/admin/resources/new">
          Publish a resource
        </Link>
        </section>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => {
            const audience = audienceLabel(item.visibility);
            return (
              <li key={item.id}>
                <Link
                  className={cn(
                    cardClassName,
                    "flex min-h-touch flex-col items-start justify-between gap-3 p-4 transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-muted sm:flex-row sm:items-center",
                  )}
                  href={`/admin/resources/${item.id}`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">{item.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {item.sourceLabel}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {item.deletedAt ? <Badge tone="support">Withdrawn</Badge> : null}
                    <Badge
                      icon={audience.restricted ? "lock" : "users"}
                      plain
                      tone={audience.restricted ? "support" : "neutral"}
                    >
                      {audience.label}
                    </Badge>
                  </span>
              </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
