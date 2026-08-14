import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { revokeSessionAction } from "@/lib/auth/actions";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { listOwnSessions } from "@/lib/auth/session-actions";
import { loadSession } from "@/lib/auth/session";

export default async function SessionsPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  let authorized;
  try {
    authorized = requireRole(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const sessions = await listOwnSessions(authorized.userId);

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Active sessions</h1>
      <ul>
        {sessions.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 py-4 text-foreground">
            <p>
              {row.userAgent} — {row.createdAt}
              {row.id === authorized.sessionId ? " (this device)" : ""}
            </p>
            {row.id === authorized.sessionId ? null : (
              <form action={revokeSessionAction}>
                <input name="sessionId" type="hidden" value={row.id} />
                <Button type="submit" variant="ghost">
                  Revoke
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
