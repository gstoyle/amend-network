import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { Icon } from "@/components/ui/icon";
import type { Destination } from "@/lib/nav/destinations";
import type { ShellIdentity } from "@/lib/profile/identity";

const ENTRY_BASE =
  "flex min-h-touch items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast ease-standard";
const ENTRY_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const ENTRY_CURRENT = "bg-sidebar-accent font-semibold text-sidebar-accent-foreground";

type NavGroupProps = {
  currentHref: string | null;
  destinations: Destination[];
  label: string;
};

function NavGroup({ currentHref, destinations, label }: NavGroupProps) {
  if (destinations.length === 0) {
    return null;
  }
  return (
    <nav aria-label={label} className="px-3 py-4">
      <ul className="flex flex-col gap-1">
        {destinations.map((destination) => {
          const current = destination.href === currentHref;
          return (
            <li key={destination.href}>
              <Link
                aria-current={current ? "page" : undefined}
                className={`${ENTRY_BASE} ${current ? ENTRY_CURRENT : ENTRY_IDLE}`}
                href={destination.href}
              >
                <span
                  aria-hidden="true"
                  className={`h-1 w-1 shrink-0 rounded-full ${current ? "bg-primary" : "bg-transparent"}`}
                />
                <Icon className="h-5 w-5 shrink-0" name={destination.iconKey} />
                {destination.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export type DesktopSidebarProps = {
  account: Destination[];
  admin: Destination[];
  currentHref: string | null;
  identity: ShellIdentity;
  primary: Destination[];
};

export function DesktopSidebar({
  account,
  admin,
  currentHref,
  identity,
  primary,
}: DesktopSidebarProps) {
  const accountEntries =
    admin.length > 0
      ? account.filter((destination) => destination.href !== "/admin")
      : account;

  return (
    <aside
      aria-label="Member"
      className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
    >
      <div className="border-b border-sidebar-border px-6 py-5">
        <Link
          className="block rounded-sm text-base font-semibold leading-tight text-sidebar-foreground"
          href="/app"
        >
          Amend Member Network
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Member portal
          </span>
        </Link>
      </div>

      <div className="border-b border-sidebar-border px-6 py-4">
        <p className="text-sm font-semibold text-sidebar-foreground">
          {identity.displayName}
        </p>
        <p className="text-xs text-muted-foreground">{identity.programRoleLabel}</p>
      </div>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
        <NavGroup currentHref={currentHref} destinations={primary} label="Primary" />
        <NavGroup currentHref={currentHref} destinations={admin} label="Administration" />
      </div>

      <div className="border-t border-sidebar-border px-3 py-4">
        <p className="flex items-start gap-2 px-3 pb-3 text-xs text-muted-foreground">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" name="shield" />
          Private to members. Do not post identifying details.
        </p>
        <nav aria-label="Account">
          <ul className="flex flex-col gap-1">
            {accountEntries.map((destination) => (
              <li key={destination.href}>
                <Link
                  aria-current={destination.href === currentHref ? "page" : undefined}
                  className={`${ENTRY_BASE} ${
                    destination.href === currentHref ? ENTRY_CURRENT : ENTRY_IDLE
                  }`}
                  href={destination.href}
                >
                  <Icon className="h-4 w-4 shrink-0" name={destination.iconKey} />
                  {destination.label}
                </Link>
              </li>
            ))}
          </ul>
          <LogoutButton />
        </nav>
      </div>
    </aside>
  );
}
