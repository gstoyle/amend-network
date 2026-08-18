"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EventFormState = {
  error?: string;
};

export type EventFormInitial = {
  title: string;
  description: string;
  visibility: string[];
  startsAt: string;
  endsAt: string;
  timezoneHint: string;
  location: string;
  isVirtual: boolean;
  joinUrl: string;
  capacity: string;
};

type EventFormProps = {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>;
  initial?: EventFormInitial;
  submitLabel: string;
  notifyRsvps?: boolean;
  capacityConfirm?: boolean;
};

const VISIBILITY_OPTIONS = [
  { value: "all_authenticated", label: "Everyone signed in" },
  { value: "pathways", label: "Pathways only" },
  { value: "lead", label: "LEAD only" },
] as const;

export function EventForm({
  action,
  initial,
  submitLabel,
  notifyRsvps = false,
  capacityConfirm = false,
}: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {state.error ? <p className="text-destructive">{state.error}</p> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input defaultValue={initial?.title} id="title" maxLength={120} name="title" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          className={controlClassName}
          defaultValue={initial?.description}
          id="description"
          maxLength={5000}
          name="description"
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
        <Label htmlFor="startsAt">Starts</Label>
        <Input
          defaultValue={initial?.startsAt}
          id="startsAt"
          name="startsAt"
          required
          type="datetime-local"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="endsAt">Ends</Label>
        <Input
          defaultValue={initial?.endsAt}
          id="endsAt"
          name="endsAt"
          required
          type="datetime-local"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="timezoneHint">Timezone hint</Label>
        <Input defaultValue={initial?.timezoneHint} id="timezoneHint" name="timezoneHint" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input defaultValue={initial?.location} id="location" maxLength={200} name="location" />
      </div>
      <label className="flex min-h-touch items-center gap-2 text-foreground">
        <input defaultChecked={initial?.isVirtual} name="isVirtual" type="checkbox" value="true" />
        Virtual meeting
      </label>
      <div className="flex flex-col gap-2">
        <Label htmlFor="joinUrl">Join URL</Label>
        <Input defaultValue={initial?.joinUrl} id="joinUrl" name="joinUrl" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="capacity">Capacity (optional)</Label>
        <Input defaultValue={initial?.capacity} id="capacity" min={1} name="capacity" type="number" />
      </div>
      {capacityConfirm ? (
        <label className="flex min-h-touch items-center gap-2 text-foreground">
          <input name="confirmCapacityShrink" type="checkbox" value="true" />
          Save even if capacity is below the current Yes count. Existing Yes RSVPs stay Yes.
        </label>
      ) : null}
      {notifyRsvps ? (
        <>
          <label className="flex min-h-touch items-center gap-2 text-foreground">
            <input name="notifyRsvps" type="checkbox" value="true" />
            Email people who RSVPed if the start or end time changes
          </label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notifyMessage">Optional message</Label>
            <textarea
              className={controlClassName}
              id="notifyMessage"
              maxLength={1000}
              name="notifyMessage"
              rows={3}
            />
          </div>
        </>
      ) : null}
      <Button disabled={pending} type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
