import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MfaForm } from "@/components/mfa-form";
import { ADMIN_ROLES, adminMfaDestination } from "@/lib/auth/admin-mfa";
import { challengeMfaAction } from "@/lib/auth/mfa-actions";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export default async function MfaChallengePage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  let authorized;
  try {
    authorized = requireRole(claims, { admin: [...ADMIN_ROLES] });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const destination = adminMfaDestination(authorized);
  if (destination === "/mfa/enroll") {
    redirect("/mfa/enroll");
  }
  if (destination === null) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-medium text-foreground">Authenticator code</h1>
      <p className="text-foreground">Enter the 6-digit code from your authenticator app.</p>
      <MfaForm action={challengeMfaAction} />
    </main>
  );
}
