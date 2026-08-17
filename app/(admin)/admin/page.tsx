import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ADMIN_ROLES } from "@/lib/auth/admin-mfa";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export default async function AdminPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    requireRole(claims, { admin: [...ADMIN_ROLES], mfa: true });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Admin</h1>
      <p className="text-foreground">You are signed in with an administrative session.</p>
      <nav aria-label="User administration" className="flex flex-col gap-2">
        <Link className="text-foreground underline" href="/admin/users/pending">
          Pending registrations
        </Link>
        <Link className="text-foreground underline" href="/admin/users/invite">
          Invitations
        </Link>
        <Link className="text-foreground underline" href="/admin/users/affiliations">
          DOC affiliations
        </Link>
        <Link className="text-foreground underline" href="/admin/resources">
          Resources
        </Link>
        <Link className="text-foreground underline" href="/admin/announcements">
          Announcements
        </Link>
      </nav>
    </div>
  );
}
