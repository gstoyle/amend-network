import { cardClassName } from "@/components/ui/card";
import type { AdminAnalyticsKpis } from "@/lib/admin-analytics/types";
import { cn } from "@/lib/utils";

export function AdminKpiCards({ kpis }: { kpis: AdminAnalyticsKpis }) {
  return (
    <section aria-label="Platform health" className="grid gap-4 md:grid-cols-2">
      <article className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
        <h2 className="text-lg font-medium text-card-foreground">Approved members</h2>
        <p className="text-2xl font-medium text-foreground">{kpis.approvedMembers}</p>
      </article>
      <article className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
        <h2 className="text-lg font-medium text-card-foreground">Monthly active members</h2>
        <p className="text-2xl font-medium text-foreground">{kpis.mam}</p>
        <p className="text-sm text-muted-foreground">
          Pathways {kpis.mamPathways} · LEAD {kpis.mamLead}
        </p>
      </article>
      <article className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
        <h2 className="text-lg font-medium text-card-foreground">Pending registrations</h2>
        <p className="text-2xl font-medium text-foreground">{kpis.pendingRegistrations}</p>
      </article>
      <article className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
        <h2 className="text-lg font-medium text-card-foreground">Live content</h2>
        <p className="text-sm text-foreground">Resources {kpis.liveResources}</p>
        <p className="text-sm text-foreground">Events {kpis.uncancelledEvents}</p>
        <p className="text-sm text-foreground">Announcements {kpis.currentAnnouncements}</p>
      </article>
    </section>
  );
}
