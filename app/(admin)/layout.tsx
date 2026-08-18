import type { ReactNode } from "react";
import Link from "next/link";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-sidebar px-gutter py-4">
        <nav aria-label="Admin" className="flex flex-wrap gap-4">
          <Link
            className="inline-flex min-h-touch items-center text-foreground underline"
            href="/admin"
          >
            Home
          </Link>
          <Link
            className="inline-flex min-h-touch items-center text-foreground underline"
            href="/admin/analytics"
          >
            Analytics
          </Link>
          <Link
            className="inline-flex min-h-touch items-center text-foreground underline"
            href="/admin/audit-log"
          >
            Audit log
          </Link>
        </nav>
        <nav aria-label="Account">
          <LogoutButton />
        </nav>
      </header>
      <main className="px-gutter py-6">{children}</main>
    </div>
  );
}
