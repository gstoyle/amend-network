import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { DesktopAccountMenu } from "@/components/shell/desktop-account-menu";
import { DesktopSidebar } from "@/components/shell/desktop-sidebar";
import { MobileTopBar } from "@/components/shell/mobile-top-bar";
import type { Destination } from "@/lib/nav/destinations";
import type { ShellIdentity } from "@/lib/profile/identity";

export type AppShellProps = {
  account: Destination[];
  admin: Destination[];
  children: ReactNode;
  identity: ShellIdentity;
  primary: Destination[];
};

export function AppShell({ account, admin, children, identity, primary }: AppShellProps) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:inline-flex focus:min-h-touch focus:items-center focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="#main-content"
      >
        Skip to main content
      </a>

      <DesktopSidebar admin={admin} primary={primary} />
      <MobileTopBar account={account} admin={admin} identity={identity} />

      <div className="lg:pl-64">
        <div className="hidden items-center justify-end border-b border-border bg-card px-gutter-lg py-3 lg:flex">
          <DesktopAccountMenu account={account} identity={identity} />
        </div>
        <main
          className="mx-auto w-full max-w-content px-gutter pb-24 pt-6 lg:px-gutter-lg lg:pb-16 lg:pt-10"
          id="main-content"
        >
          {children}
        </main>
      </div>

      <BottomTabBar destinations={primary} />
    </div>
  );
}
