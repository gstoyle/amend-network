import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AnnouncementBanners } from "@/components/announcement-banners";
import { LogoutButton } from "@/components/logout-button";
import { listEligibleBanners, type MemberBanner } from "@/lib/announcements/list";
import { AuthDeniedError, isPendingSession } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (isPendingSession(claims) && pathname !== "/app/pending") {
    redirect("/app/pending");
  }

  let banners: MemberBanner[] = [];
  if (!isPendingSession(claims) && pathname !== "/app/pending") {
    try {
      banners = await listEligibleBanners(claims);
    } catch (error) {
      if (!(error instanceof AuthDeniedError)) {
        throw error;
      }
    }
  }

  return (
    <div>
      <header>
        <nav aria-label="Member" className="flex flex-wrap gap-4 p-6">
          <Link
            className="inline-flex min-h-touch items-center text-foreground underline"
            href="/app"
          >
            Home
          </Link>
          <Link
            className="inline-flex min-h-touch items-center text-foreground underline"
            href="/app/resources"
          >
            Resources
          </Link>
        </nav>
        <nav aria-label="Account">
          <LogoutButton />
        </nav>
      </header>
      <AnnouncementBanners banners={banners} />
      <main>{children}</main>
    </div>
  );
}
