import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DirectoryPrivacyPrompt } from "@/components/directory-privacy-prompt";
import { EventRow } from "@/components/event-row";
import { ResourceCompactRow } from "@/components/resource-card";
import { ReservedPanel } from "@/components/reserved-panel";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { loadDirectoryPrivacy } from "@/lib/directory/privacy";
import { listUpcomingEvents } from "@/lib/events/list";
import { listRecentForumActivity } from "@/lib/forum/list";
import { loadShellIdentity } from "@/lib/profile/identity";
import { listResources } from "@/lib/resources/list";
import { formatDayMonthYear } from "@/lib/utils";

const PREVIEW_LIMIT = 3;

export default async function MemberHomePage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let authorized;
  try {
    authorized = requireRole(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const [identity, upcoming, resources, privacy, forum] = await Promise.all([
    loadShellIdentity(authorized),
    listUpcomingEvents(authorized),
    listResources(authorized, { sort: "newest" }),
    loadDirectoryPrivacy(authorized),
    listRecentForumActivity(authorized, PREVIEW_LIMIT),
  ]);

  const events = upcoming.slice(0, PREVIEW_LIMIT);
  const recent = resources.slice(0, PREVIEW_LIMIT);

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <header>
        <p className="eyebrow text-muted-foreground">{formatDayMonthYear(new Date())}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          {identity.firstName ? `Welcome back, ${identity.firstName}` : "Welcome back"}
        </h1>
        {identity.programRoleLabel ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge tone="primary">{identity.programRoleLabel}</Badge>
            <span>Member portal</span>
          </p>
        ) : null}
      </header>

      {privacy.privacySetAt ? null : <DirectoryPrivacyPrompt />}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-gutter-lg">
        <div className="flex flex-col gap-8 lg:col-span-8 lg:gap-10">
          <section aria-label="Upcoming events">
            <SectionHeader
              eyebrow="Training calendar"
              id="events-heading"
              linkHref="/app/events"
              linkLabel="All events"
              title="Upcoming events"
            />
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming events are scheduled for your programme.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {events.map((event) => (
                  <li key={event.id}>
                    <EventRow
                      event={{
                        ...event,
                        startsAt: event.startsAt.toISOString(),
                        endsAt: event.endsAt.toISOString(),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="resources-heading">
            <SectionHeader
              eyebrow="Library"
              id="resources-heading"
              linkHref="/app/resources"
              linkLabel="All resources"
              title="Recent resources"
            />
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing has been published to the library for your programme yet.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {recent.map((resource) => (
                  <ResourceCompactRow key={resource.id} resource={resource} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="forum-heading">
            <SectionHeader
              eyebrow="Community"
              id="forum-heading"
              linkHref="/app/forum"
              linkLabel="All categories"
              title="Recent forum activity"
            />
            {forum.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent threads in the rooms you can see.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {forum.map((thread) => (
                  <li key={thread.id}>
                    <Link
                      className="flex min-h-touch flex-col gap-1 rounded-lg border border-border bg-card p-4 text-foreground"
                      href={`/app/forum/t/${thread.id}`}
                    >
                      <span className="font-medium">{thread.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {thread.categoryName} · {thread.authorLabel} ·{" "}
                        {formatDayMonthYear(thread.lastPostedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:col-span-4">
          <ReservedPanel
            body="Amend's public writing is not published in the portal yet. It will appear here once the public blog is connected."
            eyebrow="From the blog"
            id="blog-reserved-heading"
            title="Public writing"
          />
        </aside>
      </div>
    </div>
  );
}
