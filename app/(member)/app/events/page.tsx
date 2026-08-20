import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCalendar } from "@/components/event-calendar";
import { EventRow } from "@/components/event-row";
import { PageHeader } from "@/components/page-header";
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

  const rows = events.map((event) => ({
    ...event,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Sessions, clinics, and regional gatherings open to your membership."
        eyebrow="Training calendar"
        title="Events"
      />
      <EventCalendar
        events={rows.map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.location,
          isVirtual: event.isVirtual,
        }))}
        listSlot={
          <ul className="flex flex-col gap-3">
            {rows.map((event) => (
              <li key={event.id}>
                <EventRow event={event} />
              </li>
            ))}
          </ul>
        }
        month={month}
        view={query.view}
      />
    </div>
  );
}
