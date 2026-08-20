"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type RegisterFormState = {
  message?: string;
  error?: string;
};

type RegisterFormProps = {
  affiliations: { id: string; label: string }[];
  networks: { id: string; name: string }[];
  action: (state: RegisterFormState, formData: FormData) => Promise<RegisterFormState>;
};

const initialState: RegisterFormState = {};

export function RegisterForm({ affiliations, networks, action }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="firstName">First name</Label>
        <Input id="firstName" maxLength={80} name="firstName" required type="text" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lastName">Last name</Label>
        <Input id="lastName" maxLength={80} name="lastName" required type="text" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="docAffiliation">DOC affiliation</Label>
        <Select id="docAffiliation" name="docAffiliation" required>
          <option value="">Select an affiliation</option>
          {affiliations.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title / role</Label>
        <Input id="title" maxLength={120} name="title" required type="text" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input autoComplete="username" id="email" name="email" required type="email" />
      </div>
      <div className="flex flex-col gap-1.5">
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
      <div className="flex flex-col gap-1.5">
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
        <p aria-live="polite" className="text-sm text-foreground" role="status">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        Request access
      </Button>
    </form>
  );
}
