import { cardClassName } from "@/components/ui/card";
import type {
  AdminAnalyticsEventRank,
  AdminAnalyticsResourceRank,
} from "@/lib/admin-analytics/types";
import { cn } from "@/lib/utils";

const MIN_COUNT = 3;
const MAX_ROWS = 10;

function qualifyingResources(rows: AdminAnalyticsResourceRank[]): AdminAnalyticsResourceRank[] {
  return rows.filter((row) => row.downloadCount >= MIN_COUNT).slice(0, MAX_ROWS);
}

function qualifyingEvents(rows: AdminAnalyticsEventRank[]): AdminAnalyticsEventRank[] {
  return rows.filter((row) => row.yesCount >= MIN_COUNT).slice(0, MAX_ROWS);
}

export function AdminLeaderboards({
  topResources,
  topEvents,
}: {
  topResources: AdminAnalyticsResourceRank[];
  topEvents: AdminAnalyticsEventRank[];
}) {
  const resources = qualifyingResources(topResources);
  const events = qualifyingEvents(topEvents);

  return (
    <section aria-label="Content engagement" className="grid gap-4 md:grid-cols-2">
      <article className={cn(cardClassName, "flex flex-col gap-3 p-4")}>
        <h2 className="text-lg font-medium text-card-foreground">Top resources</h2>
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No live resources with at least 3 downloads.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {resources.map((row) => (
              <li key={row.id} className="flex justify-between gap-4 text-foreground">
                <span>{row.title}</span>
                <span>{row.downloadCount}</span>
              </li>
            ))}
          </ol>
        )}
      </article>
      <article className={cn(cardClassName, "flex flex-col gap-3 p-4")}>
        <h2 className="text-lg font-medium text-card-foreground">Top events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No uncancelled events with at least 3 Yes responses.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {events.map((row) => (
              <li key={row.id} className="flex justify-between gap-4 text-foreground">
                <span>{row.title}</span>
                <span>{row.yesCount}</span>
              </li>
            ))}
          </ol>
        )}
      </article>
      <p className="text-sm text-muted-foreground md:col-span-2">
        Forum ranking is deferred; it is not available.
      </p>
    </section>
  );
}
