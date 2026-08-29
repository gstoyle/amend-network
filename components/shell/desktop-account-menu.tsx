import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { Icon } from "@/components/ui/icon";
import type { Destination } from "@/lib/nav/destinations";
import type { ShellIdentity } from "@/lib/profile/identity";

export function DesktopAccountMenu({
  account,
  identity,
}: {
  account: Destination[];
  identity: ShellIdentity;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label={`Open account menu for ${identity.displayName}`}
        className="flex min-h-touch cursor-pointer list-none items-center gap-3 rounded-md px-2 py-1 [&::-webkit-details-marker]:hidden hover:bg-muted"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-primary-subtle text-xs font-semibold text-primary-subtle-foreground"
        >
          {identity.initials}
        </span>
        <span className="text-left">
          <span className="block text-sm font-semibold leading-tight text-foreground">
            {identity.displayName}
          </span>
          <span className="block text-xs text-muted-foreground">
            {identity.programRoleLabel}
          </span>
        </span>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" name="chevron-down" />
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-md">
        {account.length > 0 ? (
          <nav aria-label="Account" className="border-b border-border p-2">
            <ul className="flex flex-col gap-1">
              {account.map((destination) => (
                <li key={destination.href}>
                  <Link
                    className="flex min-h-touch items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    href={destination.href}
                  >
                    <Icon className="h-4 w-4 shrink-0" name={destination.iconKey} />
                    {destination.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="p-2">
          <LogoutButton />
        </div>
      </div>
    </details>
  );
}
