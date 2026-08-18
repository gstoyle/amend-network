import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminFunnel } from "@/components/admin-funnel";
import { AdminKpiCards } from "@/components/admin-kpi-cards";
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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium text-foreground">Analytics</h1>
      <AdminKpiCards kpis={snapshot.kpis} />
      <AdminFunnel funnel={snapshot.funnel} networkId={networkId} networks={networks} />
    </div>
  );
}
