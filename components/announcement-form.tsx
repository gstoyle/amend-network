"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AnnouncementFormState = {
  error?: string;
};

export type AnnouncementFormInitial = {
  headline: string;
  body: string;
  visibility: string[];
  activatesAt: string;
  expiresAt: string;
  dismissible: boolean;
  ctaPrimaryLabel: string;
  ctaPrimaryUrl: string;
  ctaSecondaryLabel: string;
  ctaSecondaryUrl: string;
};

type AnnouncementFormProps = {
  action: (state: AnnouncementFormState, formData: FormData) => Promise<AnnouncementFormState>;
  initial?: AnnouncementFormInitial;
  submitLabel: string;
};

const VISIBILITY_OPTIONS = [
  { value: "all_authenticated", label: "Everyone signed in" },
  { value: "pathways", label: "Pathways only" },
  { value: "lead", label: "LEAD only" },
] as const;

export function AnnouncementForm({ action, initial, submitLabel }: AnnouncementFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {state.error ? <p className="text-destructive">{state.error}</p> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="headline">Headline</Label>
        <Input defaultValue={initial?.headline} id="headline" maxLength={120} name="headline" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Body</Label>
        <textarea
          className={controlClassName}
          defaultValue={initial?.body}
          id="body"
          maxLength={1000}
          name="body"
          required
          rows={5}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">Visibility</legend>
        {VISIBILITY_OPTIONS.map((option) => (
          <label className="flex min-h-touch items-center gap-2 text-foreground" key={option.value}>
            <input
              defaultChecked={initial?.visibility.includes(option.value) ?? option.value === "all_authenticated"}
              name="visibility"
              type="checkbox"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="activatesAt">Activates</Label>
        <Input
          defaultValue={initial?.activatesAt}
          id="activatesAt"
          name="activatesAt"
          required
          type="datetime-local"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="expiresAt">Expires</Label>
        <Input
          defaultValue={initial?.expiresAt}
          id="expiresAt"
          name="expiresAt"
          required
          type="datetime-local"
        />
      </div>
      <label className="flex min-h-touch items-center gap-2 text-foreground">
        <input
          defaultChecked={initial?.dismissible ?? true}
          name="dismissible"
          type="checkbox"
          value="true"
        />
        Members may dismiss this banner
      </label>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ctaPrimaryLabel">First button label</Label>
        <Input defaultValue={initial?.ctaPrimaryLabel} id="ctaPrimaryLabel" maxLength={40} name="ctaPrimaryLabel" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ctaPrimaryUrl">First button destination</Label>
        <Input defaultValue={initial?.ctaPrimaryUrl} id="ctaPrimaryUrl" name="ctaPrimaryUrl" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ctaSecondaryLabel">Second button label</Label>
        <Input defaultValue={initial?.ctaSecondaryLabel} id="ctaSecondaryLabel" maxLength={40} name="ctaSecondaryLabel" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ctaSecondaryUrl">Second button destination</Label>
        <Input defaultValue={initial?.ctaSecondaryUrl} id="ctaSecondaryUrl" name="ctaSecondaryUrl" />
      </div>
      <Button disabled={pending} type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
