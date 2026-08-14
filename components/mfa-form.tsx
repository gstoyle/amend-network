"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MfaFormState } from "@/lib/auth/mfa-actions";

const initialState: MfaFormState = {};

export function MfaForm({
  action,
  otpauthUri,
}: {
  action: (prev: MfaFormState, formData: FormData) => Promise<MfaFormState>;
  otpauthUri?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {otpauthUri ? (
        <p className="break-all text-sm text-muted-foreground">{otpauthUri}</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Authenticator code</Label>
        <Input
          autoComplete="one-time-code"
          id="code"
          inputMode="numeric"
          maxLength={6}
          name="code"
          pattern="\d{6}"
          required
        />
      </div>
      {state.error ? (
        <p aria-live="polite" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        Continue
      </Button>
    </form>
  );
}
