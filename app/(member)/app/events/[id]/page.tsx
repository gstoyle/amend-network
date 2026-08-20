import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AnnouncementBody } from "@/components/announcement-body";
import { EventDateChip, EventLocalTime } from "@/components/event-calendar";
import { EventRsvp } from "@/components/event-rsvp";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AuthDeniedError, isPendingSession } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getRevealedJoinUrl } from "@/lib/events/join-link";
import { getVisibleEvent } from "@/lib/events/list";
import { cn } from "@/lib/utils";

function placeText(event: { isVirtual: boolean; location: string | null }): string {
  if (event.isVirtual) {
    return event.location ? `Online · ${event.location}` : "Online";
  }
  return event.location ? `In person · ${event.location}` : "In person";
}

export default async function MemberEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let event;
  let joinUrl: string | null = null;
  try {
    event = await getVisibleEvent(claims, id);
    joinUrl = event ? await getRevealedJoinUrl(claims, id) : null;
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!event) {
    notFound();
  }

  const seats =
    event.capacity === null
      ? null
      : `${Math.max(event.capacity - event.confirmedCount, 0)} of ${event.capacity} seats remaining`;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <p>
        <Link className={cn(buttonVariants({ variant: "ghost" }), "px-0")} href="/app/events">
          Back to events
        </Link>
      </p>

      <div className="flex items-start gap-4">
        <EventDateChip startsAt={event.startsAt.toISOString()} />
        <div className="min-w-0 flex-1">
          <PageHeader eyebrow="Training calendar" title={event.title} />
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
            ) : null}
            <Badge
              icon={event.audience.restricted ? "lock" : "users"}
              plain
              tone={event.audience.restricted ? "support" : "neutral"}
            >
              {event.audience.label}
            </Badge>
          </div>
        </div>
      </div>

      <dl className={cn(cardClassName, "divide-y divide-border overflow-hidden")}>
        <div className="px-4 py-3.5">
          <dt className="eyebrow text-muted-foreground">When</dt>
          <dd className="mt-1">
            <EventLocalTime endsAt={event.endsAt.toISOString()} startsAt={event.startsAt.toISOString()} />
          </dd>
        </div>
        <div className="px-4 py-3.5">
          <dt className="eyebrow text-muted-foreground">Where</dt>
          <dd className="mt-1 flex items-start gap-1.5 text-sm text-foreground">
            <Icon className="mt-0.5 size-4 shrink-0" name="pin" />
            <span>{placeText(event)}</span>
          </dd>
        </div>
        {seats ? (
          <div className="px-4 py-3.5">
            <dt className="eyebrow text-muted-foreground">Seats</dt>
            <dd className="mt-1 text-sm text-foreground">{seats}</dd>
          </div>
        ) : null}
      </dl>

      {event.description.trim().length > 0 ? (
        <section className={cn(cardClassName, "flex flex-col gap-3 p-4")} aria-label="About this event">
          <h2 className="text-base font-semibold tracking-tight text-foreground">About</h2>
          <AnnouncementBody source={event.description} />
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {joinUrl ? (
          <a
            className={cn(buttonVariants({ variant: "default" }))}
            href={joinUrl}
            rel="noreferrer noopener"
          >
            Join meeting
          </a>
        ) : null}
        <Link
          className={cn(buttonVariants({ variant: "outline" }))}
          href={`/app/events/${event.id}/ics`}
        >
          Download calendar file
        </Link>
      </div>

      <section className={cn(cardClassName, "p-4")} aria-labelledby="event-rsvp-legend">
        <EventRsvp
          currentStatus={event.viewerRsvpStatus}
          eventId={event.id}
          legendId="event-rsvp-legend"
        />
      </section>
    </div>
  );
}
