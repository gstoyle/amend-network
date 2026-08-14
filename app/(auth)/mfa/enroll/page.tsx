import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MfaForm } from "@/components/mfa-form";
import { ADMIN_ROLES, adminMfaDestination } from "@/lib/auth/admin-mfa";
import { beginMfaEnrollment } from "@/lib/auth/mfa";
import { enrollMfaAction } from "@/lib/auth/mfa-actions";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export default async function MfaEnrollPage() {
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
  if (destination === "/mfa/challenge") {
    redirect("/mfa/challenge");
  }
  if (destination === null) {
    redirect("/admin");
  }

  const pending = await beginMfaEnrollment({
    sessionId: authorized.sessionId,
    userId: authorized.userId,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-medium text-foreground">Set up authenticator</h1>
      <p className="text-foreground">
        Add this account to your authenticator app, then enter the 6-digit code.
      </p>
      <MfaForm action={enrollMfaAction} otpauthUri={pending.otpauthUri} />
    </main>
  );
}
