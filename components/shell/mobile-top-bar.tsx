import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { Icon } from "@/components/ui/icon";
import type { Destination } from "@/lib/nav/destinations";
import type { ShellIdentity } from "@/lib/profile/identity";
import { cn } from "@/lib/utils";

const MENU_LINK =
  "flex min-h-touch items-center gap-3 rounded-md px-3 py-2 text-sm font-medium";

export function MobileTopBar({
  account,
  admin,
  currentHref,
  identity,
}: {
  account: Destination[];
  admin: Destination[];
  currentHref: string | null;
  identity: ShellIdentity;
}) {
  const hasMenu = account.length > 0 || admin.length > 0;

  function menuItems(destinations: Destination[]) {
    return destinations.map((destination) => (
      <li key={destination.href}>
        <Link
          aria-current={destination.href === currentHref ? "page" : undefined}
          className={cn(
            MENU_LINK,
            destination.href === currentHref
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          href={destination.href}
        >
          <Icon className="size-4 shrink-0" name={destination.iconKey} />
          {destination.label}
        </Link>
      </li>
    ));
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card lg:hidden">
      <div className="flex items-center justify-between gap-3 px-gutter py-2">
        <Link className="min-h-touch rounded-sm py-1" href="/app">
          <span className="block text-sm font-semibold leading-tight text-foreground">
            Amend Member Network
          </span>
          <span className="block text-xs text-muted-foreground">Member portal</span>
        </Link>

        {hasMenu ? (
          <details className="group relative" key={currentHref ?? "account-menu"}>
            <summary
              aria-label={`Open account menu for ${identity.displayName}`}
              className="flex min-h-touch min-w-touch cursor-pointer list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-primary-subtle text-xs font-semibold text-primary-subtle-foreground"
              >
                {identity.initials}
              </span>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-md">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{identity.displayName}</p>
                <p className="text-xs text-muted-foreground">{identity.programRoleLabel}</p>
              </div>
              {admin.length > 0 ? (
                <nav aria-label="Administration" className="border-b border-border p-2">
                  <p className="eyebrow px-3 py-2 text-muted-foreground">Administration</p>
                  <ul className="max-h-popover overflow-y-auto">{menuItems(admin)}</ul>
                </nav>
              ) : null}
              <nav aria-label="Account" className="p-2">
                <ul>{menuItems(account)}</ul>
                <LogoutButton />
              </nav>
            </div>
          </details>
        ) : null}
      </div>
    </header>
  );
}
