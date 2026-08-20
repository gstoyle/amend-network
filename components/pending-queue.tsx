import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PendingQueueItem = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  docAffiliationLabel: string;
  networkId: string | null;
  networkName: string;
  submittedAt: string;
  registrationIp: string;
};

type PendingQueueProps = {
  items: PendingQueueItem[];
  networks: { id: string; name: string }[];
  selectedNetworkId?: string;
  approveAction: (formData: FormData) => Promise<void>;
  denyAction: (formData: FormData) => Promise<void>;
};

export function PendingQueue({
  items,
  networks,
  selectedNetworkId,
  approveAction,
  denyAction,
}: PendingQueueProps) {
  return (
    <div className="flex flex-col gap-6">
      <form
        className={cn(cardClassName, "flex flex-col gap-3 p-4 sm:flex-row sm:items-end")}
        method="get"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="networkId">Filter by network</Label>
          <Select
            defaultValue={selectedNetworkId ?? ""}
            id="networkId"
            name="networkId"
          >
            <option value="">All networks</option>
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Apply filter
        </Button>
      </form>

      {items.length === 0 ? (
        <section className={cn(cardClassName, "border-dashed p-6 text-center")}>
          <h2 className="font-semibold text-foreground">No pending registrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New access requests will appear here for review.
          </p>
        </section>
      ) : (
        <ul className="grid gap-4">
          {items.map((item) => (
            <li className={cn(cardClassName, "flex flex-col gap-5 p-4 lg:p-6")} key={item.id}>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {item.firstName} {item.lastName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[item.title, item.email].filter(Boolean).join(" · ")}
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Affiliation</dt>
                    <dd className="font-medium text-foreground">{item.docAffiliationLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Requested network</dt>
                    <dd className="font-medium text-foreground">{item.networkName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Submitted</dt>
                    <dd className="font-medium text-foreground">{item.submittedAt}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Registration IP</dt>
                    <dd className="font-medium text-foreground">{item.registrationIp}</dd>
                  </div>
                </dl>
              </div>
              <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
                <form action={approveAction} className="flex flex-col gap-2">
                  <input name="userId" type="hidden" value={item.id} />
                  <Label htmlFor={`network-${item.id}`}>Assign network</Label>
                  <Select
                    defaultValue={item.networkId ?? ""}
                    id={`network-${item.id}`}
                    name="networkId"
                  >
                    {networks.map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit">Approve registration</Button>
                </form>
                <form action={denyAction} className="flex flex-col gap-2">
                  <input name="userId" type="hidden" value={item.id} />
                  <Label htmlFor={`reason-${item.id}`}>Denial reason (admin only)</Label>
                  <Input id={`reason-${item.id}`} name="reason" type="text" />
                  <Button type="submit" variant="destructive">
                    Deny registration
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
