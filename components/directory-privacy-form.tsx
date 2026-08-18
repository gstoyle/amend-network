"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

export type DirectoryPrivacyFormState = {
  error?: string;
};

const INITIAL: DirectoryPrivacyFormState = {};

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
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      <p className="text-foreground">
        If you appear in the directory, members in your same program can see you.
        Super Admin, Admin, and Moderator can see listed members of both programs.
        Your name and network are always shown while you are listed. DOC affiliation,
        title, and email stay hidden unless you turn each one on. Hiding a field
        hides it from every directory viewer, including staff — not only peers.
      </p>
      {canAppear ? null : (
        <p className="text-foreground">
          Only Pathways and LEAD program members can appear in the directory.
          Staff-only accounts are not listed.
        </p>
      )}
      <label className="flex min-h-touch items-center gap-3 text-foreground">
        <input
          className="min-h-touch min-w-touch"
          defaultChecked={listing}
          name="listing"
          type="checkbox"
          value="true"
        />
        Appear in the member directory
      </label>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-foreground">
          Optional fields (hidden unless turned on)
        </legend>
        <label className="flex min-h-touch items-center gap-3 text-foreground">
          <input
            className="min-h-touch min-w-touch"
            defaultChecked={showTitle}
            name="showTitle"
            type="checkbox"
            value="true"
          />
          Show title{title ? ` (${title})` : ""}
        </label>
        <label className="flex min-h-touch items-center gap-3 text-foreground">
          <input
            className="min-h-touch min-w-touch"
            defaultChecked={showDocAffiliation}
            name="showDocAffiliation"
            type="checkbox"
            value="true"
          />
          Show DOC affiliation{docLabel ? ` (${docLabel})` : ""}
        </label>
        <label className="flex min-h-touch items-center gap-3 text-foreground">
          <input
            className="min-h-touch min-w-touch"
            defaultChecked={showEmail}
            name="showEmail"
            type="checkbox"
            value="true"
          />
          Show email{email ? ` (${email})` : ""}
        </label>
      </fieldset>
      {state.error ? (
        <p aria-live="polite" role="alert" className="text-foreground">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit">Save privacy settings</Button>
      </div>
    </form>
  );
}
