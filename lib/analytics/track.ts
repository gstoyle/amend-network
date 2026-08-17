import { env } from "@/lib/env";

export type AnalyticsEventName =
  | "resource_viewed"
  | "resource_downloaded"
  | "announcement_impression"
  | "announcement_cta_click";

export type AnalyticsPayload = {
  distinctId: string;
  programRole: string;
  adminRole: string;
  announcementId?: string;
  ctaSlot?: "primary" | "secondary";
};

const ALLOWED_KEYS = new Set([
  "distinctId",
  "programRole",
  "adminRole",
  "announcementId",
  "ctaSlot",
]);
const BLOCKED_KEYS = new Set([
  "email",
  "name",
  "title",
  "headline",
  "body",
  "ctaLabel",
  "url",
  "tags",
  "fileObjectKey",
  "thumbnailObjectKey",
]);

export function track(event: AnalyticsEventName, payload: AnalyticsPayload): void {
  const keys = Object.keys(payload);
  for (const key of keys) {
    if (!ALLOWED_KEYS.has(key) || BLOCKED_KEYS.has(key.toLowerCase())) {
      throw new Error("analytics payload must not contain extra or PII fields");
    }
  }
  if (!env().POSTHOG_KEY) {
    return;
  }
  switch (event) {
    case "resource_viewed":
    case "resource_downloaded":
    case "announcement_impression":
    case "announcement_cta_click":
      return;
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
