import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AnnouncementBanners } from "@/components/announcement-banners";
import { AppShell } from "@/components/app-shell";
import { listEligibleBanners, type MemberBanner } from "@/lib/announcements/list";
import { AuthDeniedError, isPendingSession } from "@/lib/auth/requireRole";
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
      <div className="flex flex-col gap-6 lg:gap-8">
        <AnnouncementBanners banners={banners} />
        {children}
      </div>
    </AppShell>
  );
}
