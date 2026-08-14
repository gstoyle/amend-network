import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/logout-button";
import { adminMfaDestination } from "@/lib/auth/admin-mfa";
import { loadSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const destination = adminMfaDestination(claims);
  if (destination) {
    redirect(destination);
  }

  return (
    <div>
      <header>
        <nav aria-label="Account">
          <LogoutButton />
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
