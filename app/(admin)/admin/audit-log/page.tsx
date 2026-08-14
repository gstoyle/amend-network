import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { listAuditLog } from "@/lib/audit/read";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export default async function AuditLogPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const requestHeaders = await headers();
  let page;
  try {
    page = await listAuditLog(claims, {
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Audit log</h1>
      <ul>
        {page.rows.map((row) => (
          <li key={row.id} className="text-foreground">
            {row.createdAt} {row.actorRole} {row.action} {row.severity}
          </li>
        ))}
      </ul>
    </div>
  );
}
