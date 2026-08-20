import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { DesktopSidebar } from "@/components/shell/desktop-sidebar";
import { MobileTopBar } from "@/components/shell/mobile-top-bar";
import { currentDestination, type Destination } from "@/lib/nav/destinations";
import type { ShellIdentity } from "@/lib/profile/identity";

export type AppShellProps = {
  account: Destination[];
  admin: Destination[];
  children: ReactNode;
  identity: ShellIdentity;
  pathname: string;
  primary: Destination[];
};

export function AppShell({
  account,
  admin,
  children,
  identity,
  pathname,
  primary,
}: AppShellProps) {
  const currentHref =
    currentDestination(pathname, [...primary, ...admin, ...account])?.href ?? null;

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:inline-flex focus:min-h-touch focus:items-center focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="#main-content"
      >
        Skip to main content
      </a>

      <DesktopSidebar
        account={account}
        admin={admin}
        currentHref={currentHref}
        identity={identity}
        primary={primary}
      />
      <MobileTopBar
        account={account}
        admin={admin}
        currentHref={currentHref}
        identity={identity}
      />

      <div className="lg:pl-64">
        <main
          className="mx-auto w-full max-w-content px-gutter pb-24 pt-6 lg:px-gutter-lg lg:pb-16 lg:pt-10"
          id="main-content"
        >
          {children}
        </main>
      </div>

      <BottomTabBar currentHref={currentHref} destinations={primary} />
    </div>
  );
}
