import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { revokeSessionAction } from "@/lib/auth/actions";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { listOwnSessions } from "@/lib/auth/session-actions";
import { loadSession } from "@/lib/auth/session";
import { cn, formatDayMonthYear } from "@/lib/utils";

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
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Devices currently signed in to your account. Revoking a session signs that device out."
        eyebrow="Account"
        title="Active sessions"
      />
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((row) => (
            <li className={cn(cardClassName, "flex flex-col gap-3 p-4")} key={row.id}>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {row.id === authorized.sessionId ? "This device" : "Other device"}
                </p>
                <p className="mt-1 break-all text-sm text-muted-foreground">{row.userAgent}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Signed in {formatDayMonthYear(new Date(row.createdAt))}
                </p>
              </div>
              {row.id === authorized.sessionId ? null : (
                <form action={revokeSessionAction}>
                  <input name="sessionId" type="hidden" value={row.id} />
                  <Button type="submit" variant="outline">
                    Revoke
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
