import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { EVENT_STAFF_ROLES, listAdminEvents } from "@/lib/events/publish";

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
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Events</h1>
      <p>
        <Link className="text-foreground underline" href="/admin/events/new">
          New event
        </Link>
      </p>
      {items.length === 0 ? (
        <p className="text-foreground">No events in this view.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li className="text-foreground" key={item.id}>
              <p className="font-medium">
                <Link className="underline" href={`/admin/events/${item.id}`}>
                  {item.title}
                </Link>
              </p>
              <p className="text-sm">
                {item.cancelledAt ? "cancelled" : "scheduled"} · {item.visibility.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
