import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminKpiCards } from "@/components/admin-kpi-cards";
import { PageHeader } from "@/components/page-header";
import { cardClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { loadAdminAnalytics } from "@/lib/admin-analytics/load";
import type { AdminAnalyticsKpis } from "@/lib/admin-analytics/types";
import { ADMIN_ROLES } from "@/lib/auth/admin-mfa";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { adminDestinations } from "@/lib/nav/destinations";
import { cn } from "@/lib/utils";

const ADMIN_DESCRIPTIONS: Record<string, string> = {
  "/admin/analytics": "Review membership and content engagement.",
  "/admin/audit-log": "Trace administrative and security activity.",
  "/admin/resources": "Publish, update, and withdraw library items.",
  "/admin/events": "Create events and manage registration details.",
  "/admin/forum": "Manage categories and discussion settings.",
  "/admin/forum/flags": "Review member-reported forum posts.",
  "/admin/announcements": "Schedule notices shown in the member portal.",
  "/admin/users/pending": "Approve or deny access requests.",
  "/admin/users/invite": "Invite members individually or by CSV.",
  "/admin/users/affiliations": "Maintain the affiliation choices used at registration.",
};

export default async function AdminPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    requireRole(claims, { admin: [...ADMIN_ROLES], mfa: true });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  let kpis: AdminAnalyticsKpis | null = null;
  try {
    kpis = (await loadAdminAnalytics(claims, null)).kpis;
  } catch (error) {
    if (!(error instanceof AuthDeniedError)) {
      throw error;
    }
  }

  const tools = adminDestinations(claims).filter((destination) => destination.href !== "/admin");

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Monitor activity and manage members, content, events, and community operations."
        eyebrow="Administration"
        title="Admin home"
      />
      {kpis ? <AdminKpiCards kpis={kpis} /> : null}
      <nav aria-label="Administrative tools">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((destination) => (
            <li key={destination.href}>
              <Link
                className={cn(
                  cardClassName,
                  "group flex h-full min-h-touch items-start gap-3 p-4 transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-muted",
                )}
                href={destination.href}
              >
                <span className="flex h-tap w-tap shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                  <Icon className="size-5" name={destination.iconKey} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-foreground">{destination.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {ADMIN_DESCRIPTIONS[destination.href]}
                  </span>
                </span>
                <span aria-hidden="true" className="text-muted-foreground group-hover:text-foreground">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
