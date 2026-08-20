"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type InviteListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  networkName: string;
  status: "pending" | "expired" | "revoked";
  expiresAt: string;
};

export type InviteFormState = {
  message?: string;
  error?: string;
  invalid?: { email: string; reason: string }[];
};

type InviteFormProps = {
  networks: { id: string; name: string }[];
  items: InviteListItem[];
  manualAction: (state: InviteFormState, formData: FormData) => Promise<InviteFormState>;
  csvAction: (state: InviteFormState, formData: FormData) => Promise<InviteFormState>;
  revokeAction: (formData: FormData) => Promise<void>;
  reissueAction: (formData: FormData) => Promise<void>;
};

const initialState: InviteFormState = {};

export function InviteForm({
  networks,
  items,
  manualAction,
  csvAction,
  revokeAction,
  reissueAction,
}: InviteFormProps) {
  const [manualState, manualFormAction, manualPending] = useActionState(manualAction, initialState);
  const [csvState, csvFormAction, csvPending] = useActionState(csvAction, initialState);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <form
          action={manualFormAction}
          className={cn(cardClassName, "flex flex-col gap-4 p-4 lg:p-6")}
        >
          <div>
            <h2 className="text-lg font-semibold text-foreground">Invite one member</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Send an invitation to a single person.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input autoComplete="off" id="email" name="email" required type="email" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" maxLength={80} name="firstName" required type="text" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" maxLength={80} name="lastName" required type="text" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="networkId">Network</Label>
            <Select id="networkId" name="networkId" required>
              <option value="">Select a network</option>
              {networks.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title / role (optional)</Label>
            <Input id="title" maxLength={120} name="title" type="text" />
          </div>
          {manualState.message ? (
            <p className="text-sm text-success" aria-live="polite" role="status">
              {manualState.message}
            </p>
          ) : null}
          {manualState.error ? (
            <p className="text-sm text-destructive" aria-live="polite" role="alert">
              {manualState.error}
            </p>
          ) : null}
          <Button disabled={manualPending} type="submit">
            {manualPending ? "Sending…" : "Send invitation"}
          </Button>
        </form>

        <form
          action={csvFormAction}
          className={cn(cardClassName, "flex flex-col gap-4 p-4 lg:p-6")}
        >
          <div>
            <h2 className="text-lg font-semibold text-foreground">Invite from CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a file or paste CSV with no more than 500 data rows.
            </p>
          </div>
          <p className="rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
            email,first_name,last_name,network_name,title,doc_affiliation
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="csvFile">CSV file</Label>
            <Input accept=".csv,text/csv" id="csvFile" name="csvFile" type="file" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="csvText">Or paste CSV</Label>
            <textarea
              className={cn(controlClassName, "min-h-32")}
              id="csvText"
              name="csvText"
              spellCheck={false}
            />
          </div>
          {csvState.message ? (
            <p className="text-sm text-success" aria-live="polite" role="status">
              {csvState.message}
            </p>
          ) : null}
          {csvState.error ? (
            <p className="text-sm text-destructive" aria-live="polite" role="alert">
              {csvState.error}
            </p>
          ) : null}
          {csvState.invalid && csvState.invalid.length > 0 ? (
            <ul aria-live="polite" className="flex flex-col gap-1 text-sm text-foreground">
              {csvState.invalid.map((row, index) => (
                <li key={`${row.email}-${row.reason}-${index}`}>
                  {row.email || "(missing email)"}: {row.reason}
                </li>
              ))}
            </ul>
          ) : null}
          <Button disabled={csvPending} type="submit">
            {csvPending ? "Sending…" : "Send CSV invitations"}
          </Button>
        </form>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-foreground">Outstanding invitations</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unused, expired, or revoked invitations.</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((item) => (
              <li
                className={cn(
                  cardClassName,
                  "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
                )}
                key={item.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {item.firstName} {item.lastName}
                    </p>
                    <Badge tone={item.status === "pending" ? "primary" : "neutral"}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{item.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.networkName} · Expires {item.expiresAt}
                  </p>
                </div>
                {item.status === "pending" ? (
                  <form action={revokeAction}>
                    <input name="invitationId" type="hidden" value={item.id} />
                    <Button type="submit" variant="outline">
                      Revoke
                    </Button>
                  </form>
                ) : (
                  <form action={reissueAction}>
                    <input name="invitationId" type="hidden" value={item.id} />
                    <Button type="submit">Re-issue</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
