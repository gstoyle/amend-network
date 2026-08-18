"use client";

import { Button } from "@/components/ui/button";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <form className="flex flex-col gap-2" method="get">
        <Label htmlFor="networkId">Filter by network</Label>
        <select
          className={controlClassName}
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
        </select>
        <Button type="submit" variant="outline">
          Apply filter
        </Button>
      </form>

      <ul className="flex flex-col gap-6">
        {items.map((item) => (
          <li className="flex flex-col gap-3" key={item.id}>
            <p className="text-foreground">
              {item.firstName} {item.lastName} · {item.title} · {item.email}
            </p>
            <p className="text-foreground">
              {item.docAffiliationLabel} · {item.networkName} · {item.submittedAt} ·{" "}
              {item.registrationIp}
            </p>
            <form action={approveAction} className="flex flex-col gap-2">
              <input name="userId" type="hidden" value={item.id} />
              <Label htmlFor={`network-${item.id}`}>Assign network</Label>
              <select
                className={controlClassName}
                defaultValue={item.networkId ?? ""}
                id={`network-${item.id}`}
                name="networkId"
              >
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
              <Button type="submit">Approve</Button>
            </form>
            <form action={denyAction} className="flex flex-col gap-2">
              <input name="userId" type="hidden" value={item.id} />
              <Label htmlFor={`reason-${item.id}`}>Denial reason (admin only)</Label>
              <Input id={`reason-${item.id}`} name="reason" type="text" />
              <Button type="submit" variant="outline">
                Deny
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
