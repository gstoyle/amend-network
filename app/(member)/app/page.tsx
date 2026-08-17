import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listVisibleRecords } from "@/lib/db/visibility";

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

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Home</h1>
      <p className="text-foreground">You are signed in.</p>
      <p>
        <Link className="text-foreground underline" href="/app/resources">
          Resources
        </Link>
      </p>
      <ul>
        {records.map((record) => (
          <li key={record.id}>{record.title}</li>
        ))}
      </ul>
    </div>
  );
}
