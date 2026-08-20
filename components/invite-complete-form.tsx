"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type InviteCompleteFormState = {
  message?: string;
  error?: string;
};

type InviteCompleteFormProps = {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  networkName: string;
  docAffiliationId?: string;
  affiliations: { id: string; label: string }[];
  action: (
    state: InviteCompleteFormState,
    formData: FormData,
  ) => Promise<InviteCompleteFormState>;
};

const initialState: InviteCompleteFormState = {};

export function InviteCompleteForm({
  token,
  email,
  firstName,
  lastName,
  title,
  networkName,
  docAffiliationId,
  affiliations,
  action,
}: InviteCompleteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input name="token" type="hidden" value={token} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" readOnly type="email" value={email} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="firstName">First name</Label>
        <Input id="firstName" name="firstName" readOnly type="text" value={firstName} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lastName">Last name</Label>
        <Input id="lastName" name="lastName" readOnly type="text" value={lastName} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="networkName">Network</Label>
        <Input id="networkName" name="networkName" readOnly type="text" value={networkName} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title / role</Label>
        <Input
          defaultValue={title}
          id="title"
          maxLength={120}
          name="title"
          required
          type="text"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="docAffiliation">DOC affiliation</Label>
        <Select
          defaultValue={docAffiliationId ?? ""}
          id="docAffiliation"
          name="docAffiliation"
          required
        >
          <option value="">Select an affiliation</option>
          {affiliations.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </div>
      {state.message ? (
        <p aria-live="polite" role="status">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p aria-live="polite" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        Complete registration
      </Button>
    </form>
  );
}
