import React from 'react';
import { EventRow } from '../components/events/EventRow';
import { events } from '../data/portal';

export function Events() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <p className="eyebrow text-muted-foreground">Training calendar</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          Events
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Sessions, clinics, and regional gatherings open to your membership. Times shown in Central
          Time.
        </p>
      </header>

      <ul className="space-y-3 border-t border-border pt-6">
        {events.map((event) =>
        <li key={event.id}>
            <EventRow event={event} />
          </li>
        )}
      </ul>
    </div>);

}