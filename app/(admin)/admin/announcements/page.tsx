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
import { listAdminAnnouncements } from "@/lib/announcements/publish";
import { cn } from "@/lib/utils";

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Scheduled", value: "scheduled" },
  { label: "Active", value: "active" },
  { label: "Expired", value: "expired" },
  { label: "Withdrawn", value: "withdrawn" },
] as const;

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const claims = await loadClaims();
  const params = await searchParams;
  const statusFilter =
    params.status === "scheduled" ||
    params.status === "active" ||
    params.status === "expired" ||
    params.status === "withdrawn"
      ? params.status
      : undefined;
  let items;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    items = await listAdminAnnouncements(claims, statusFilter ? { status: statusFilter } : undefined);
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
          <Link className={buttonVariants()} href="/admin/announcements/new">
          New announcement
        </Link>
        }
        description="Schedule and maintain notices shown at the top of the member portal."
        eyebrow="Administration"
        title="Announcements"
      />
      <nav aria-label="Filter announcements" className="flex flex-wrap gap-3">
        {FILTERS.map((filter) => {
          const selected = filter.value === statusFilter;
          const href = filter.value
            ? `/admin/announcements?status=${filter.value}`
            : "/admin/announcements";
          return (
            <Link
              aria-current={selected ? "page" : undefined}
              className={buttonVariants({ variant: selected ? "secondary" : "ghost" })}
              href={href}
              key={filter.label}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>
      {items.length === 0 ? (
        <section className={cn(cardClassName, "border-dashed p-6 text-center")}>
          <h2 className="font-semibold text-foreground">No announcements in this view</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another status or create a new announcement.
          </p>
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
                  href={`/admin/announcements/${item.id}`}
                >
                  <span className="min-w-0 font-semibold text-foreground">{item.headline}</span>
                  <span className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <Badge tone={item.status === "active" ? "primary" : "neutral"}>
                      {item.status}
                    </Badge>
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
