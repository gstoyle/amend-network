import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventDateChip, EventLocalTime } from "@/components/event-calendar";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { audienceLabel } from "@/lib/db/visibility";
import { EVENT_STAFF_ROLES, listAdminEvents } from "@/lib/events/publish";
import { cn } from "@/lib/utils";

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

export default async function AdminEventsPage() {
  const claims = await loadClaims();
  let items;
  try {
    requireRole(claims, { admin: [...EVENT_STAFF_ROLES], mfa: true });
    items = await listAdminEvents(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        actions={
          <Link className={buttonVariants()} href="/admin/events/new">
            New event
          </Link>
        }
        description="Schedule training, manage event details, and review registration totals."
        eyebrow="Administration"
        title="Events"
      />
      {items.length === 0 ? (
        <section className={cn(cardClassName, "border-dashed p-6 text-center")}>
          <h2 className="font-semibold text-foreground">No events yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the first event to add it to the member calendar.
          </p>
          <Link className={cn(buttonVariants(), "mt-4")} href="/admin/events/new">
          New event
        </Link>
        </section>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => {
            const audience = audienceLabel(item.visibility);
            return (
              <li key={item.id}>
                <Link
                  className={cn(
                    cardClassName,
                    "flex items-start gap-4 p-4 transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-muted",
                  )}
                  href={`/admin/events/${item.id}`}
                >
                  <EventDateChip startsAt={item.startsAt.toISOString()} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground">{item.title}</span>
                    <div className="mt-1 text-muted-foreground">
                      <EventLocalTime
                        endsAt={item.endsAt.toISOString()}
                        startsAt={item.startsAt.toISOString()}
                      />
                    </div>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={item.cancelledAt ? "support" : "primary"}>
                        {item.cancelledAt ? "Cancelled" : "Scheduled"}
                      </Badge>
                      <Badge
                        icon={audience.restricted ? "lock" : "users"}
                        plain
                        tone={audience.restricted ? "support" : "neutral"}
                      >
                        {audience.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.rsvpCount} {item.rsvpCount === 1 ? "response" : "responses"}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
