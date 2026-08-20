"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import type { CalendarView } from "@/lib/events/list";
import { cn } from "@/lib/utils";

const navButtonClassName =
  "inline-flex min-h-touch items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors duration-fast ease-standard hover:bg-muted";

export type CalendarEventItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  isVirtual: boolean;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

function monthKey(year: number, month: number): string {
  return `${year}-${padMonth(month)}`;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const cursor = new Date(year, month - 1 + delta, 1);
  return { year: cursor.getFullYear(), month: cursor.getMonth() + 1 };
}

function parseMonthKey(value: string | null, fallback: Date): { year: number; month: number } {
  if (value) {
    const [yearRaw, monthRaw] = value.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (Number.isInteger(year) && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 };
}

function overlapsDay(event: CalendarEventItem, dayStart: Date): boolean {
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return new Date(event.startsAt) < dayEnd && new Date(event.endsAt) > dayStart;
}

/**
 * Decorative month-and-day tile. Lives here beside the other time rendering so it
 * resolves in the same locale and zone as the row's text date and cannot disagree.
 */
export function EventDateChip({ startsAt }: { startsAt: string }) {
  const start = new Date(startsAt);
  return (
    <div
      aria-hidden="true"
      className="flex size-14 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted"
      suppressHydrationWarning
    >
      <span className="eyebrow text-muted-foreground">
        {start.toLocaleString("en-GB", { month: "short" })}
      </span>
      <span className="text-lg font-semibold leading-none text-foreground">
        {start.toLocaleString("en-GB", { day: "numeric" })}
      </span>
    </div>
  );
}

/**
 * Compact one-line date and time for a list row: "Thursday 21 Aug · 10:00–12:30".
 * The year is omitted because the day chip beside it and the surrounding list are
 * already anchored in time; `dateTime` keeps the full value machine-readable.
 */
export function EventRowTime({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  // Day-month order and 24-hour times, matching formatDayMonthYear elsewhere in
  // the product. The zone stays the viewer's, which is why this is client-side.
  const day = start.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const clock = { hour: "2-digit", minute: "2-digit" } as const;
  return (
    <p className="text-xs text-muted-foreground" suppressHydrationWarning>
      <span className="sr-only">Date and time: </span>
      <time dateTime={startsAt}>
        {day} · {start.toLocaleTimeString("en-GB", clock)}
      </time>
      {"–"}
      <time dateTime={endsAt}>{end.toLocaleTimeString("en-GB", clock)}</time>
    </p>
  );
}

export function EventLocalTime({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const startText = start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const endText = end.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <p className="text-sm text-foreground">
      <time dateTime={startsAt}>{startText}</time>
      {" – "}
      <time dateTime={endsAt}>{endText}</time>
    </p>
  );
}

function viewHref(view: CalendarView, year: number, month: number): string {
  return `/app/events?view=${view}&month=${monthKey(year, month)}`;
}

export function EventCalendar({
  events,
  listSlot,
  view,
  month,
}: {
  events: CalendarEventItem[];
  /** Server-rendered list rows. Passed in so the designed row can stay a server
   * component while the month grid remains client-side. */
  listSlot?: ReactNode;
  view: CalendarView;
  month: string | null;
}) {
  const cursor = parseMonthKey(month, new Date());
  const previous = shiftMonth(cursor.year, cursor.month, -1);
  const next = shiftMonth(cursor.year, cursor.month, 1);
  const caption = new Date(cursor.year, cursor.month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const cells: Array<{ day: number | null }> = [
    ...Array.from({ length: firstWeekday }, () => ({ day: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1 })),
  ];
  while (cells.length % 7 !== 0) {
    cells.push({ day: null });
  }
  const weeks: Array<Array<{ day: number | null }>> = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        aria-label="Calendar view"
        className="inline-flex self-start rounded-md border border-border bg-card p-1"
        role="group"
      >
        {(["list", "month"] as const).map((option) => (
          <Link
            aria-current={view === option ? "page" : undefined}
            className={cn(
              "inline-flex min-h-touch items-center justify-center rounded-sm px-4 text-sm font-medium capitalize transition-colors duration-fast ease-standard",
              view === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            href={viewHref(option, cursor.year, cursor.month)}
            key={option}
          >
            {option}
          </Link>
        ))}
      </div>

      {view === "list" ? (
        events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events in this view.</p>
        ) : (
          (listSlot ?? (
            <ul className="flex flex-col gap-3">
              {events.map((event) => (
                <li className="text-foreground" key={event.id}>
                  <Link
                    className="inline-flex min-h-touch items-center font-medium underline"
                    href={`/app/events/${event.id}`}
                  >
                    {event.title}
                  </Link>
                  <EventLocalTime endsAt={event.endsAt} startsAt={event.startsAt} />
                  {event.location ? <p>{event.location}</p> : null}
                </li>
              ))}
            </ul>
          ))
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              className={cn(navButtonClassName, "gap-1")}
              href={viewHref("month", previous.year, previous.month)}
            >
              <Icon className="size-4 rotate-180" name="arrow-right" />
              Previous month
            </Link>
            <p className="text-base font-semibold tracking-tight text-foreground">{caption}</p>
            <Link
              className={cn(navButtonClassName, "gap-1")}
              href={viewHref("month", next.year, next.month)}
            >
              Next month
              <Icon className="size-4" name="arrow-right" />
            </Link>
          </div>
          <table className="w-full table-fixed border-collapse overflow-hidden rounded-lg border border-border bg-card text-foreground">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {WEEKDAYS.map((day) => (
                  <th
                    className="border-b border-border p-2 text-left text-xs font-medium text-muted-foreground"
                    key={day}
                    scope="col"
                  >
                    <span className="hidden lg:inline">{day}</span>
                    <span className="lg:hidden">{day.slice(0, 3)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((cell, cellIndex) => {
                    if (cell.day === null) {
                      return (
                        <td
                          className="border-b border-r border-border bg-muted p-2 align-top"
                          key={`empty-${weekIndex}-${cellIndex}`}
                        />
                      );
                    }
                    const dayStart = new Date(cursor.year, cursor.month - 1, cell.day);
                    const dayEvents = events.filter((event) => overlapsDay(event, dayStart));
                    return (
                      <td
                        className="h-20 border-b border-r border-border p-2 align-top lg:h-24"
                        key={cell.day}
                      >
                        <p className="text-xs font-medium text-muted-foreground">{cell.day}</p>
                        {dayEvents.length > 0 ? (
                          <ul className="mt-1 flex flex-col gap-1">
                            {dayEvents.map((event) => (
                              <li key={event.id}>
                                <Link
                                  className="flex min-h-touch items-center rounded-xs bg-primary-subtle px-1.5 text-xs font-medium text-primary-subtle-foreground transition-colors duration-fast ease-standard hover:bg-primary hover:text-primary-foreground"
                                  href={`/app/events/${event.id}`}
                                  title={event.title}
                                >
                                  {event.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
