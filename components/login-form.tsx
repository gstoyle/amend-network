"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginFormState } from "@/lib/auth/actions";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="username"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete="current-password"
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
      <Button disabled={pending} type="submit">
        Sign in
      </Button>
    </form>
  );
}
