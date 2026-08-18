import React from 'react';
import { Check, MapPin } from 'lucide-react';
import { Button } from '../ui/Button';
import { AccessBadge } from '../common/AccessBadge';
import type { EventItem } from '../../types/portal';

type EventRowProps = {
  event: EventItem;
};

export function EventRow({ event }: EventRowProps) {
  return (
    <article className="flex gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div
        aria-hidden="true"
        className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted">
        
        <span className="eyebrow text-muted-foreground">{event.month}</span>
        <span className="text-lg font-semibold leading-none text-foreground">{event.day}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <span className="sr-only">Date and time: </span>
          {event.weekday} {event.day} {event.month} · {event.time}
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground">
          <a
            href="#event"
            className="rounded-sm underline decoration-transparent underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-border-strong">
            
            {event.title}
          </a>
        </h3>

        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {event.format} · {event.location}
          </span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {event.registered ?
          <span className="inline-flex min-h-tap items-center gap-1.5 text-sm font-medium text-success">
              <Check aria-hidden="true" className="h-4 w-4" />
              You are registered
            </span> :

          <Button variant="outline" className="min-h-tap border-border-strong">
              Register
            </Button>
          }
          <span className="text-xs text-muted-foreground">{event.seatsNote}</span>
          <AccessBadge access={event.access} />
        </div>
      </div>
    </article>);

}