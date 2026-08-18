import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AnnouncementBody } from "@/components/announcement-body";
import { EventLocalTime } from "@/components/event-calendar";
import { EventRsvp } from "@/components/event-rsvp";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getVisibleEvent } from "@/lib/events/list";
import { getOwnEventRsvp } from "@/lib/events/rsvp";

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
  let currentStatus;
  try {
    requireRole(claims);
    event = await getVisibleEvent(claims, id);
    currentStatus = event ? await getOwnEventRsvp(claims, id) : null;
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!event) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 p-6 text-foreground">
      <p>
        <Link className="underline" href="/app/events">
          Back to events
        </Link>
      </p>
      <h1 className="text-2xl font-medium">{event.title}</h1>
      <EventLocalTime endsAt={event.endsAt.toISOString()} startsAt={event.startsAt.toISOString()} />
      {event.location ? <p>{event.location}</p> : null}
      {event.isVirtual ? <p>This is an online event.</p> : null}
      {event.capacity !== null ? <p>Capacity {event.capacity}</p> : null}
      <AnnouncementBody source={event.description} />
      <EventRsvp currentStatus={currentStatus} eventId={event.id} />
    </div>
  );
}
