import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { adminMfaDestination } from "@/lib/auth/admin-mfa";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import {
  accountDestinations,
  adminDestinations,
  memberDestinations,
} from "@/lib/nav/destinations";
import { loadShellIdentity, type ShellIdentity } from "@/lib/profile/identity";

const ANONYMOUS_IDENTITY: ShellIdentity = {
  displayName: "Member",
  initials: "—",
  programRoleLabel: "",
  firstName: null,
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const destination = adminMfaDestination(claims);
  if (destination) {
    redirect(destination);
  }
  let identity = ANONYMOUS_IDENTITY;
  if (claims) {
    try {
      identity = await loadShellIdentity(claims);
    } catch (error) {
      if (!(error instanceof AuthDeniedError)) {
        throw error;
      }
    }
  }

  return (
    <AppShell
      account={accountDestinations(claims)}
      admin={adminDestinations(claims)}
      identity={identity}
      primary={memberDestinations(claims)}
    >
      {children}
    </AppShell>
  );
}
