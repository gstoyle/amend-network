import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export default async function PendingPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    requireRole(claims, { statuses: ["pending"] });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Request under review</h1>
      <p className="text-foreground">
        Your registration is pending review. You will be able to use the member area once it is
        approved.
      </p>
    </div>
  );
}
