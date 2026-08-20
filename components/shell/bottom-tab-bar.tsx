import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { Destination } from "@/lib/nav/destinations";

const ITEM_BASE =
  "flex min-h-touch flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors duration-fast ease-standard";

export function BottomTabBar({
  currentHref,
  destinations,
}: {
  currentHref: string | null;
  destinations: Destination[];
}) {
  if (destinations.length === 0) {
    return null;
  }
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border-strong bg-card shadow-bar lg:hidden"
      // Device measurement, not a design value: keeps targets clear of a reserved bottom edge.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-content items-stretch">
        {destinations.map((destination) => {
          const current = destination.href === currentHref;
          return (
            <li className="flex-1" key={destination.href}>
              <Link
                aria-current={current ? "page" : undefined}
                className={`${ITEM_BASE} ${
                  current
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                href={destination.href}
              >
                <span
                  aria-hidden="true"
                  className={`h-0.5 w-6 rounded-full ${current ? "bg-primary" : "bg-transparent"}`}
                />
                <Icon className="h-5 w-5" name={destination.iconKey} />
                {destination.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
