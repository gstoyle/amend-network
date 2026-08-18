import React from 'react';
import { AnnouncementBanner } from '../components/dashboard/AnnouncementBanner';
import { BlogSidebar } from '../components/dashboard/BlogSidebar';
import { ForumActivityList } from '../components/dashboard/ForumActivityList';
import { EventRow } from '../components/events/EventRow';
import { ResourceCompactRow } from '../components/resources/ResourceCompactRow';
import { SectionHeader } from '../components/common/SectionHeader';
import { RoleBadge } from '../components/common/RoleBadge';
import { currentMember, events, resources } from '../data/portal';

export function Dashboard() {
  return (
    <div className="space-y-8 lg:space-y-10">
      <header>
        <p className="eyebrow text-muted-foreground">Thursday 17 August</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          Welcome back, {currentMember.name.split(' ')[0]}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <RoleBadge role={currentMember.role} />
          <span>
            {currentMember.region} · {currentMember.memberSince}
          </span>
        </p>
      </header>

      <AnnouncementBanner />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-gutter-lg">
        <div className="space-y-8 lg:col-span-8 lg:space-y-10">
          <section aria-labelledby="events-heading">
            <SectionHeader
              id="events-heading"
              eyebrow="Training calendar"
              title="Upcoming events"
              linkLabel="All events"
              linkTo="/events" />
            
            <div className="space-y-3">
              {events.slice(0, 3).map((event) =>
              <EventRow key={event.id} event={event} />
              )}
            </div>
          </section>

          <section aria-labelledby="resources-heading">
            <SectionHeader
              id="resources-heading"
              eyebrow="Library"
              title="Recent resources"
              linkLabel="All resources"
              linkTo="/resources" />
            
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {resources.slice(0, 3).map((resource) =>
              <ResourceCompactRow key={resource.id} resource={resource} />
              )}
            </ul>
          </section>

          <section aria-labelledby="forum-heading">
            <SectionHeader
              id="forum-heading"
              eyebrow="Discussion"
              title="Recent forum activity"
              linkLabel="Open forum"
              linkTo="/forum" />
            
            <ForumActivityList />
          </section>
        </div>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-10">
            <BlogSidebar />
          </div>
        </aside>
      </div>
    </div>);

}