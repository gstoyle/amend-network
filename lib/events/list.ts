import { track } from "@/lib/analytics/track";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { visibilityTokens } from "@/lib/db/visibility";

const MEMBER_EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  timezoneHint: true,
  location: true,
  isVirtual: true,
  capacity: true,
} as const;

export type MemberEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  timezoneHint: string | null;
  location: string | null;
  isVirtual: boolean;
  capacity: number | null;
};

export type CalendarView = "month" | "list";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function parseCalendarQuery(input: {
  view?: string | string[];
  month?: string | string[];
}): { view: CalendarView; month: string | null } {
  const viewRaw = firstParam(input.view);
  const monthRaw = firstParam(input.month)?.trim() ?? "";
  const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : null;
  return {
    view: viewRaw === "list" ? "list" : "month",
    month,
  };
}

function toMemberEvent(row: {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  timezoneHint: string | null;
  location: string | null;
  isVirtual: boolean;
  capacity: number | null;
}): MemberEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezoneHint: row.timezoneHint,
    location: row.location,
    isVirtual: row.isVirtual,
    capacity: row.capacity,
  };
}

async function loadVisibleEvents(
  claims: SessionClaims,
  extra: { id?: string; upcoming?: boolean },
): Promise<MemberEvent[]> {
  const tokens = visibilityTokens(claims);
  if (tokens.length === 0) {
    return [];
  }
  const now = new Date();
  const rows = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) =>
      tx.event.findMany({
        where: {
          cancelledAt: null,
          visibility: { hasSome: tokens },
          ...(extra.id ? { id: extra.id } : {}),
          ...(extra.upcoming ? { startsAt: { gte: now } } : {}),
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        select: MEMBER_EVENT_SELECT,
      }),
  );
  return rows.map(toMemberEvent);
}

export async function listVisibleEvents(
  session: SessionClaims | null,
): Promise<MemberEvent[]> {
  const claims = requireRole(session);
  return loadVisibleEvents(claims, {});
}

export async function listUpcomingEvents(
  session: SessionClaims | null,
): Promise<MemberEvent[]> {
  const claims = requireRole(session);
  return loadVisibleEvents(claims, { upcoming: true });
}

export async function getVisibleEvent(
  session: SessionClaims | null,
  id: string,
  options?: { trackView?: boolean },
): Promise<MemberEvent | null> {
  const claims = requireRole(session);
  const rows = await loadVisibleEvents(claims, { id });
  const event = rows[0] ?? null;
  if (event && options?.trackView !== false) {
    track("event_viewed", {
      distinctId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      eventId: event.id,
    });
  }
  return event;
}
