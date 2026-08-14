import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/logout-button";
import { isPendingSession } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (isPendingSession(claims) && pathname !== "/app/pending") {
    redirect("/app/pending");
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
