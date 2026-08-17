"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

const selectClassName = cn(
  "flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

export function RegisterForm({ affiliations, networks, action }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="firstName">First name</Label>
        <Input id="firstName" maxLength={80} name="firstName" required type="text" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lastName">Last name</Label>
        <Input id="lastName" maxLength={80} name="lastName" required type="text" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="docAffiliation">DOC affiliation</Label>
        <select className={selectClassName} id="docAffiliation" name="docAffiliation" required>
          <option value="">Select an affiliation</option>
          {affiliations.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title / role</Label>
        <Input id="title" maxLength={120} name="title" required type="text" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input autoComplete="username" id="email" name="email" required type="email" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="networkId">Network</Label>
        <select className={selectClassName} id="networkId" name="networkId" required>
          <option value="">Select a network</option>
          {networks.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
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
        Request access
      </Button>
    </form>
  );
}
