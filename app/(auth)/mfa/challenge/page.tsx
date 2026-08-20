import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
import { MfaForm } from "@/components/mfa-form";
import { ADMIN_ROLES, mfaSetupDestination } from "@/lib/auth/admin-mfa";
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

  const destination = mfaSetupDestination(authorized);
  if (destination === "/mfa/enroll") {
    redirect("/mfa/enroll");
  }
  if (destination === null) {
    redirect("/admin");
  }

  return (
    <AuthSplit
      description="Enter the 6-digit code from your authenticator app. This check is optional for now."
      footer={
        <p className="text-sm text-muted-foreground">
          Continue without a code?{" "}
          <Link className={authLinkClassName} href="/admin">
            Skip for now
          </Link>
        </p>
      }
      panelAction={{ href: "/admin", label: "Back to admin" }}
      title="Authenticator code"
    >
      <MfaForm action={challengeMfaAction} />
    </AuthSplit>
  );
}
