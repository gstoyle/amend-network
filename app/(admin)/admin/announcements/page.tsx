import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listAdminAnnouncements } from "@/lib/announcements/publish";

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const claims = await loadClaims();
  const params = await searchParams;
  const statusFilter =
    params.status === "scheduled" ||
    params.status === "active" ||
    params.status === "expired" ||
    params.status === "withdrawn"
      ? params.status
      : undefined;
  let items;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    items = await listAdminAnnouncements(claims, statusFilter ? { status: statusFilter } : undefined);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Announcements</h1>
      <p>
        <Link className="text-foreground underline" href="/admin/announcements/new">
          New announcement
        </Link>
      </p>
      <nav aria-label="Filter announcements" className="flex flex-wrap gap-3">
        <Link className="text-foreground underline" href="/admin/announcements">
          All
        </Link>
        <Link className="text-foreground underline" href="/admin/announcements?status=scheduled">
          Scheduled
        </Link>
        <Link className="text-foreground underline" href="/admin/announcements?status=active">
          Active
        </Link>
        <Link className="text-foreground underline" href="/admin/announcements?status=expired">
          Expired
        </Link>
        <Link className="text-foreground underline" href="/admin/announcements?status=withdrawn">
          Withdrawn
        </Link>
      </nav>
      {items.length === 0 ? (
        <p className="text-foreground">No announcements in this view.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li className="text-foreground" key={item.id}>
              <p className="font-medium">
                <Link className="underline" href={`/admin/announcements/${item.id}`}>
                  {item.headline}
                </Link>
              </p>
              <p className="text-sm">
                {item.status} · {item.visibility.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
