"use client";

import { Button } from "@/components/ui/button";
import type { StoredRsvpStatus } from "@/lib/events/rsvp";

const CHOICES = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Maybe" },
] as const;

export function EventRsvp({
  eventId,
  currentStatus,
}: {
  eventId: string;
  currentStatus: StoredRsvpStatus | null;
}) {
  return (
    <form
      action={`/app/events/${eventId}/rsvp`}
      className="flex flex-col gap-3"
      method="post"
    >
      <fieldset className="flex flex-wrap gap-2">
        <legend className="text-sm font-medium text-foreground">Your RSVP</legend>
        {CHOICES.map((choice) => (
          <Button
            aria-pressed={currentStatus === choice.value}
            key={choice.value}
            name="status"
            type="submit"
            value={choice.value}
            variant={currentStatus === choice.value ? "default" : "outline"}
          >
            {choice.label}
          </Button>
        ))}
      </fieldset>
      {currentStatus === "waitlist" ? (
        <p className="text-foreground">This event is full. You are on the waitlist.</p>
      ) : null}
    </form>
  );
}
