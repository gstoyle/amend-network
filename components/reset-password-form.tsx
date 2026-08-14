"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeResetAction, type ResetCompleteState } from "@/lib/auth/actions";

const initialState: ResetCompleteState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(completeResetAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input name="token" type="hidden" value={token} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p aria-live="polite" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p aria-live="polite" role="status">
          Password updated. You can sign in.
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        Update password
      </Button>
    </form>
  );
}
