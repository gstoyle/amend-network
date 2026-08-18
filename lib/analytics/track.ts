import { env } from "@/lib/env";

export type AnalyticsEventName =
  | "resource_viewed"
  | "resource_downloaded"
  | "announcement_impression"
  | "announcement_cta_click"
  | "event_viewed"
  | "event_rsvp"
  | "directory_search"
  | "directory_profile_viewed";

export type AnalyticsRsvpStatus = "yes" | "no" | "maybe" | "waitlist";

export type AnalyticsPayload = {
  distinctId: string;
  programRole: string;
  adminRole: string;
  announcementId?: string;
  ctaSlot?: "primary" | "secondary";
  eventId?: string;
  rsvpStatus?: AnalyticsRsvpStatus;
  viewedUserId?: string;
};

const ALLOWED_KEYS = new Set([
  "distinctId",
  "programRole",
  "adminRole",
  "announcementId",
  "ctaSlot",
  "eventId",
  "rsvpStatus",
  "viewedUserId",
]);
const BLOCKED_KEYS = new Set([
  "email",
  "name",
  "title",
  "query",
  "q",
  "doc",
  "doclabel",
  "affiliation",
  "headline",
  "body",
  "ctaLabel",
  "url",
  "tags",
  "fileObjectKey",
  "thumbnailObjectKey",
  "description",
  "location",
  "virtualLink",
]);

const ALLOWED_RSVP_STATUS = new Set<AnalyticsRsvpStatus>(["yes", "no", "maybe", "waitlist"]);

export function track(event: AnalyticsEventName, payload: AnalyticsPayload): void {
  const keys = Object.keys(payload);
  for (const key of keys) {
    if (!ALLOWED_KEYS.has(key) || BLOCKED_KEYS.has(key.toLowerCase())) {
      throw new Error("analytics payload must not contain extra or PII fields");
    }
  }
  if (payload.rsvpStatus !== undefined && !ALLOWED_RSVP_STATUS.has(payload.rsvpStatus)) {
    throw new Error("analytics payload must not contain extra or PII fields");
  }
  if (!env().POSTHOG_KEY) {
    return;
  }
  switch (event) {
    case "resource_viewed":
    case "resource_downloaded":
    case "announcement_impression":
    case "announcement_cta_click":
    case "event_viewed":
    case "event_rsvp":
    case "directory_search":
    case "directory_profile_viewed":
      return;
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
