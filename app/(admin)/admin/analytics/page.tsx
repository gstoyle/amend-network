import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminFunnel } from "@/components/admin-funnel";
import { AdminKpiCards } from "@/components/admin-kpi-cards";
import { AdminLeaderboards } from "@/components/admin-leaderboards";
import { PageHeader } from "@/components/page-header";
import { loadAdminAnalytics, parseAnalyticsNetworkQuery } from "@/lib/admin-analytics/load";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listLaunchNetworks } from "@/lib/registration/register";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string | string[] }>;
}) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const networkId = parseAnalyticsNetworkQuery((await searchParams).network);
  let snapshot;
  try {
    snapshot = await loadAdminAnalytics(claims, networkId);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  const networks = await listLaunchNetworks();

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Monitor membership, return activity, and content engagement without exposing member PII."
        eyebrow="Administration"
        title="Analytics"
      />
      <AdminKpiCards kpis={snapshot.kpis} />
      <AdminFunnel funnel={snapshot.funnel} networkId={networkId} networks={networks} />
      <AdminLeaderboards topEvents={snapshot.topEvents} topResources={snapshot.topResources} />
    </div>
  );
}
