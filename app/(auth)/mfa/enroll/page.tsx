import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
import { MfaForm } from "@/components/mfa-form";
import { ADMIN_ROLES, mfaSetupDestination } from "@/lib/auth/admin-mfa";
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

  const destination = mfaSetupDestination(authorized);
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
    <AuthSplit
      description="Optional. Add this account to your authenticator app, then enter its 6-digit code."
      footer={
        <p className="text-sm text-muted-foreground">
          Not ready?{" "}
          <Link className={authLinkClassName} href="/admin">
            Skip for now
          </Link>
        </p>
      }
      panelAction={{ href: "/admin", label: "Back to admin" }}
      title="Set up authenticator"
    >
      <MfaForm action={enrollMfaAction} otpauthUri={pending.otpauthUri} />
    </AuthSplit>
  );
}
