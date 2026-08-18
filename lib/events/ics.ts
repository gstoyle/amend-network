import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { getRevealedJoinUrl } from "@/lib/events/join-link";
import { getVisibleEvent } from "@/lib/events/list";

export type IcsEventInput = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  joinUrl?: string | null;
};

export type EventIcsFile = {
  filename: string;
  body: string;
};

function icsUtc(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function buildEventIcs(input: IcsEventInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Amend//Member Network//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.id}`,
    `DTSTAMP:${icsUtc(new Date())}`,
    `DTSTART:${icsUtc(input.startsAt)}`,
    `DTEND:${icsUtc(input.endsAt)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }
  if (input.joinUrl) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.joinUrl)}`);
    lines.push(`URL:${input.joinUrl}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export async function getEventIcs(
  session: SessionClaims | null,
  eventId: string,
): Promise<EventIcsFile | null> {
  requireRole(session);
  const event = await getVisibleEvent(session, eventId, { trackView: false });
  if (!event) {
    return null;
  }
  const joinUrl = await getRevealedJoinUrl(session, eventId);
  return {
    filename: `${event.id}.ics`,
    body: buildEventIcs({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.location,
      joinUrl,
    }),
  };
}
