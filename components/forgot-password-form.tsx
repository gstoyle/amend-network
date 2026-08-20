"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestResetAction, type ResetRequestState } from "@/lib/auth/actions";

const initialState: ResetRequestState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input autoComplete="username" id="email" name="email" required type="email" />
      </div>
      {state.success ? (
        <p aria-live="polite" className="text-sm text-foreground" role="status">
          If that email is eligible, you will receive instructions.
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        Send reset link
      </Button>
    </form>
  );
}
