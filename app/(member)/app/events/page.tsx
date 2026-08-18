import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCalendar } from "@/components/event-calendar";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listVisibleEvents, parseCalendarQuery } from "@/lib/events/list";

export default async function MemberEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; month?: string | string[] }>;
}) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  const query = parseCalendarQuery(await searchParams);
  const now = new Date();
  const month =
    query.month ??
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let events;
  try {
    requireRole(claims);
    events = await listVisibleEvents(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Events</h1>
      <p>
        <Link className="text-foreground underline" href="/app">
          Home
        </Link>
      </p>
      <EventCalendar
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          location: event.location,
          isVirtual: event.isVirtual,
        }))}
        month={month}
        view={query.view}
      />
    </div>
  );
}
