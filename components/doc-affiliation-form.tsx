"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="label">New affiliation</Label>
          <Input id="label" maxLength={120} name="label" required type="text" />
        </div>
        {state.error ? (
          <p aria-live="polite" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button disabled={pending} type="submit">
          Add
        </Button>
      </form>

      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li className="flex flex-col gap-2" key={item.id}>
            <form action={editAction} className="flex flex-col gap-2">
              <input name="id" type="hidden" value={item.id} />
              <Label htmlFor={`label-${item.id}`}>{item.active ? "Active" : "Inactive"}</Label>
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
                <Button type="submit" variant="outline">
                  Deactivate
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
