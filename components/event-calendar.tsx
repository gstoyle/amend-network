"use client";

import Link from "next/link";
import type { CalendarView } from "@/lib/events/list";

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

export function EventLocalTime({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const startText = start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const endText = end.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <p className="text-foreground">
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
  view,
  month,
}: {
  events: CalendarEventItem[];
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Calendar view">
        <Link
          aria-current={view === "month" ? "page" : undefined}
          className="inline-flex min-h-touch min-w-touch items-center justify-center text-foreground underline"
          href={viewHref("month", cursor.year, cursor.month)}
        >
          Month
        </Link>
        <Link
          aria-current={view === "list" ? "page" : undefined}
          className="inline-flex min-h-touch min-w-touch items-center justify-center text-foreground underline"
          href={viewHref("list", cursor.year, cursor.month)}
        >
          List
        </Link>
      </div>

      {view === "list" ? (
        events.length === 0 ? (
          <p className="text-foreground">No events in this view.</p>
        ) : (
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
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="inline-flex min-h-touch min-w-touch items-center justify-center text-foreground underline"
              href={viewHref("month", previous.year, previous.month)}
            >
              Previous month
            </Link>
            <p className="text-foreground">{caption}</p>
            <Link
              className="inline-flex min-h-touch min-w-touch items-center justify-center text-foreground underline"
              href={viewHref("month", next.year, next.month)}
            >
              Next month
            </Link>
          </div>
          <table className="w-full border-collapse text-foreground">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {WEEKDAYS.map((day) => (
                  <th className="p-2 text-left text-sm font-medium" key={day} scope="col">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((cell, cellIndex) => {
                    if (cell.day === null) {
                      return <td className="align-top p-2" key={`empty-${weekIndex}-${cellIndex}`} />;
                    }
                    const dayStart = new Date(cursor.year, cursor.month - 1, cell.day);
                    const dayEvents = events.filter((event) => overlapsDay(event, dayStart));
                    return (
                      <td className="align-top p-2" key={cell.day}>
                        <p className="text-sm">{cell.day}</p>
                        {dayEvents.length > 0 ? (
                          <ul className="flex flex-col gap-1">
                            {dayEvents.map((event) => (
                              <li key={event.id}>
                                <Link
                                  className="inline-flex min-h-touch items-center text-sm underline"
                                  href={`/app/events/${event.id}`}
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
