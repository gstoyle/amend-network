import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventLocalTime } from "@/components/event-calendar";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listVisibleRecords } from "@/lib/db/visibility";
import { listUpcomingEvents } from "@/lib/events/list";

export default async function MemberHomePage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let authorized;
  try {
    authorized = requireRole(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const records = await listVisibleRecords(authorized);
  const upcoming = await listUpcomingEvents(authorized);

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Home</h1>
      <p className="text-foreground">You are signed in.</p>
      <p>
        <Link className="text-foreground underline" href="/app/resources">
          Resources
        </Link>
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium text-foreground">Upcoming events</h2>
        <p>
          <Link className="text-foreground underline" href="/app/events">
            All events
          </Link>
        </p>
        {upcoming.length === 0 ? (
          <p className="text-foreground">No upcoming events.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((event) => (
              <li className="text-foreground" key={event.id}>
                <Link
                  className="inline-flex min-h-touch items-center font-medium underline"
                  href={`/app/events/${event.id}`}
                >
                  {event.title}
                </Link>
                <EventLocalTime
                  endsAt={event.endsAt.toISOString()}
                  startsAt={event.startsAt.toISOString()}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <ul>
        {records.map((record) => (
          <li key={record.id}>{record.title}</li>
        ))}
      </ul>
    </div>
  );
}
