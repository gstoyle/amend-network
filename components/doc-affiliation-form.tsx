"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AffiliationItem = {
  id: string;
  label: string;
  active: boolean;
};

export type AffiliationFormState = {
  error?: string;
};

type DocAffiliationFormProps = {
  items: AffiliationItem[];
  addAction: (
    state: AffiliationFormState,
    formData: FormData,
  ) => Promise<AffiliationFormState>;
  editAction: (formData: FormData) => Promise<void>;
  deactivateAction: (formData: FormData) => Promise<void>;
};

const initialState: AffiliationFormState = {};

export function DocAffiliationForm({
  items,
  addAction,
  editAction,
  deactivateAction,
}: DocAffiliationFormProps) {
  const [state, formAction, pending] = useActionState(addAction, initialState);

  return (
    <div className="flex flex-col gap-8">
      <form
        action={formAction}
        className={cn(cardClassName, "flex flex-col gap-4 p-4 sm:flex-row sm:items-end")}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="label">New affiliation</Label>
          <Input id="label" maxLength={120} name="label" required type="text" />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive" aria-live="polite" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button disabled={pending} type="submit">
          {pending ? "Adding…" : "Add affiliation"}
        </Button>
      </form>

      {items.length === 0 ? (
        <section className={cn(cardClassName, "border-dashed p-6 text-center")}>
          <h2 className="font-semibold text-foreground">No affiliations yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the first affiliation above.
          </p>
        </section>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li className={cn(cardClassName, "flex flex-col gap-3 p-4")} key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`label-${item.id}`}>Affiliation label</Label>
                <Badge tone={item.active ? "primary" : "neutral"}>
                  {item.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <form action={editAction} className="flex flex-col gap-2 sm:flex-row">
                <input name="id" type="hidden" value={item.id} />
                <Input
                  defaultValue={item.label}
                  id={`label-${item.id}`}
                  maxLength={120}
                  name="label"
                  required
                  type="text"
                />
                <Button type="submit">Save label</Button>
              </form>
              {item.active ? (
                <form action={deactivateAction}>
                  <input name="id" type="hidden" value={item.id} />
                  <Button type="submit" variant="ghost">
                    Deactivate
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
