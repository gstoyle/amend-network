import Link from "next/link";
import type { Destination } from "@/lib/nav/destinations";
import type { ShellIdentity } from "@/lib/profile/identity";

export function MobileTopBar({
  account,
  identity,
}: {
  account: Destination[];
  identity: ShellIdentity;
}) {
  const accountHref = account[0]?.href;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card lg:hidden">
      <div className="flex items-center justify-between gap-3 px-gutter py-2">
        <Link className="min-h-touch rounded-sm py-1" href="/app">
          <span className="block text-sm font-semibold leading-tight text-foreground">
            Amend Member Network
          </span>
          <span className="block text-xs text-muted-foreground">Member portal</span>
        </Link>

        {accountHref ? (
          <Link
            aria-label={`Your account, ${identity.displayName}`}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-md"
            href={accountHref}
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-primary-subtle text-xs font-semibold text-primary-subtle-foreground"
            >
              {identity.initials}
            </span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
