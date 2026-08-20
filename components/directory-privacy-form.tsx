"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DirectoryPrivacyFormState = {
  error?: string;
};

const INITIAL: DirectoryPrivacyFormState = {};

function ToggleRow({
  defaultChecked,
  hint,
  label,
  name,
}: {
  defaultChecked: boolean;
  hint?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 rounded-md border border-border bg-background px-3 py-3">
      <input
        className="mt-0.5 min-h-touch min-w-touch shrink-0 accent-primary"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
        value="true"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function DirectoryPrivacyForm({
  listing,
  showTitle,
  showDocAffiliation,
  showEmail,
  title,
  docLabel,
  email,
  canAppear,
  action,
}: {
  listing: boolean;
  showTitle: boolean;
  showDocAffiliation: boolean;
  showEmail: boolean;
  title: string;
  docLabel: string;
  email: string;
  canAppear: boolean;
  action: (
    prev: DirectoryPrivacyFormState,
    formData: FormData,
  ) => Promise<DirectoryPrivacyFormState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        If you appear in the directory, members in your same program can see you.
        Super Admin, Admin, and Moderator can see listed members of both programs.
        Your name and network are always shown while you are listed. DOC affiliation,
        title, and email stay hidden unless you turn each one on. Hiding a field
        hides it from every directory viewer, including staff — not only peers.
      </p>
      {canAppear ? null : (
        <p className="text-sm text-muted-foreground">
          Only Pathways and LEAD program members can appear in the directory.
          Staff-only accounts are not listed.
        </p>
      )}
      <div className={cn(cardClassName, "flex flex-col gap-3 p-4")}>
        <ToggleRow
          defaultChecked={listing}
          label="Appear in the member directory"
          name="listing"
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-foreground">
            Optional fields (hidden unless turned on)
          </legend>
          <ToggleRow
            defaultChecked={showTitle}
            hint={title || undefined}
            label="Show title"
            name="showTitle"
          />
          <ToggleRow
            defaultChecked={showDocAffiliation}
            hint={docLabel || undefined}
            label="Show DOC affiliation"
            name="showDocAffiliation"
          />
          <ToggleRow
            defaultChecked={showEmail}
            hint={email || undefined}
            label="Show email"
            name="showEmail"
          />
        </fieldset>
      </div>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit">Save privacy settings</Button>
      </div>
    </form>
  );
}
