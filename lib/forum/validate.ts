import { parseVisibility } from "@/lib/announcements/validate";

export { parseVisibility };

export const FORUM_RATE_LIMIT_MESSAGE = "Try again later.";
export const FORUM_EDIT_WINDOW_MS = 15 * 60 * 1000;

export function assertForumTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 120) {
    throw new Error("Title must be 1 to 120 characters.");
  }
  return trimmed;
}

export function assertForumBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 8000) {
    throw new Error("Body must be 1 to 8,000 characters.");
  }
  if (trimmed.includes("<") || trimmed.includes(">")) {
    throw new Error("Body cannot include HTML.");
  }
  return trimmed;
}

export function assertForumReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new Error("Choose a reason between 1 and 500 characters.");
  }
  if (trimmed.includes("<") || trimmed.includes(">")) {
    throw new Error("Reason cannot include HTML.");
  }
  return trimmed;
}

export function assertCategoryName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new Error("Name must be 1 to 80 characters.");
  }
  return trimmed;
}

export function assertCategorySlug(slug: string): string {
  const trimmed = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens.");
  }
  return trimmed;
}

export function assertCategoryDescription(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new Error("Description must be 1 to 500 characters.");
  }
  return trimmed;
}

export function authorLabelFrom(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const last = lastName.trim();
  if (!first && !last) {
    return "Member";
  }
  if (!last) {
    return first;
  }
  if (!first) {
    return last;
  }
  return `${first} ${last.charAt(0)}.`;
}
