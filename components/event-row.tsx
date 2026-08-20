import Link from "next/link";
import { EventDateChip, EventRowTime } from "@/components/event-calendar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { AudienceMarker } from "@/lib/db/visibility";
import type { StoredRsvpStatus } from "@/lib/events/rsvp";
import { cn } from "@/lib/utils";

export type EventRowData = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  isVirtual: boolean;
  capacity: number | null;
  confirmedCount: number;
  viewerRsvpStatus: StoredRsvpStatus | null;
  audience: AudienceMarker;
};

function placeText(event: EventRowData): string {
  if (event.isVirtual) {
    return event.location ? `Online · ${event.location}` : "Online";
  }
  return event.location ? `In person · ${event.location}` : "In person";
}

function seatsNote(event: EventRowData): string | null {
  if (event.capacity === null) {
    return null;
  }
  const remaining = Math.max(event.capacity - event.confirmedCount, 0);
  return `${remaining} of ${event.capacity} seats remaining`;
}

export function EventRow({ event }: { event: EventRowData }) {
  const seats = seatsNote(event);

  return (
    <article className={cn(cardClassName, "flex gap-4 p-4 shadow-xs")}>
      <EventDateChip startsAt={event.startsAt} />

      <div className="min-w-0 flex-1">
        <EventRowTime endsAt={event.endsAt} startsAt={event.startsAt} />

        <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground">
          <Link
            className="rounded-sm underline decoration-transparent underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-border-strong"
            href={`/app/events/${event.id}`}
          >
            {event.title}
          </Link>
        </h3>

        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
          <Icon className="mt-0.5 size-4 shrink-0" name="pin" />
          <span>{placeText(event)}</span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {event.viewerRsvpStatus === "yes" ? (
            <span className="inline-flex min-h-touch items-center gap-1.5 text-sm font-medium text-success">
              <Icon className="size-4" name="check" />
              You are registered
            </span>
          ) : event.viewerRsvpStatus === "waitlist" ? (
            <span className="inline-flex min-h-touch items-center gap-1.5 text-sm font-medium text-warning">
              You are on the waitlist
            </span>
          ) : (
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "border-border-strong")}
              href={`/app/events/${event.id}`}
            >
              Register
            </Link>
          )}
          {seats ? <span className="text-xs text-muted-foreground">{seats}</span> : null}
          <Badge
            icon={event.audience.restricted ? "lock" : "users"}
            plain
            tone={event.audience.restricted ? "support" : "neutral"}
          >
            {event.audience.label}
          </Badge>
        </div>
      </div>
    </article>
  );
}
