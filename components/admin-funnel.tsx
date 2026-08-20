import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { AdminAnalyticsFunnel } from "@/lib/admin-analytics/types";
import { cn } from "@/lib/utils";

export type AdminFunnelNetwork = {
  id: string;
  name: string;
};

export function AdminFunnel({
  funnel,
  networkId,
  networks,
}: {
  funnel: AdminAnalyticsFunnel;
  networkId: string | null;
  networks: AdminFunnelNetwork[];
}) {
  const selected = networkId ?? "all";
  const known = networkId == null || networks.some((network) => network.id === networkId);

  return (
    <section aria-label="Join to return funnel" className="flex flex-col gap-4">
      <form action="/admin/analytics" className="flex max-w-xl flex-col gap-3" method="get">
        <Label htmlFor="analytics-network">Network</Label>
        <Select
          defaultValue={known ? selected : "all"}
          id="analytics-network"
          name="network"
        >
          <option value="all">All networks</option>
          {networks.map((network) => (
            <option key={network.id} value={network.id}>
              {network.name}
            </option>
          ))}
        </Select>
        <Button type="submit">Apply</Button>
      </form>
      {known ? null : (
        <p className="text-sm text-muted-foreground">No matching network.</p>
      )}
      <ol className="grid gap-4 md:grid-cols-2">
        <li className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
          <h2 className="text-lg font-medium text-card-foreground">Invitation</h2>
          <p className="text-2xl font-medium text-foreground">{funnel.invitation}</p>
        </li>
        <li className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
          <h2 className="text-lg font-medium text-card-foreground">Registration</h2>
          <p className="text-2xl font-medium text-foreground">{funnel.registration}</p>
        </li>
        <li className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
          <h2 className="text-lg font-medium text-card-foreground">Approval</h2>
          <p className="text-2xl font-medium text-foreground">{funnel.approval}</p>
        </li>
        <li className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
          <h2 className="text-lg font-medium text-card-foreground">First login</h2>
          <p className="text-2xl font-medium text-foreground">{funnel.firstLogin}</p>
        </li>
        <li className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
          <h2 className="text-lg font-medium text-card-foreground">30-day retention</h2>
          <p className="text-2xl font-medium text-foreground">
            {funnel.retained} of {funnel.retentionEligible}
          </p>
          <p className="text-sm text-muted-foreground">
            Members whose first sign-in was fewer than 30 days ago are omitted (not yet eligible).
          </p>
        </li>
      </ol>
    </section>
  );
}
