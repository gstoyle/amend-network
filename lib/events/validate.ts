import { isAllowedDestination, parseVisibility } from "@/lib/announcements/validate";

export { parseVisibility };

export function assertEventTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 120) {
    throw new Error("Title must be 1 to 120 characters.");
  }
  return trimmed;
}

export function assertEventDescription(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length < 1 || trimmed.length > 5000) {
    throw new Error("Description must be 1 to 5,000 characters.");
  }
  if (trimmed.includes("<") || trimmed.includes(">")) {
    throw new Error("Description cannot include HTML.");
  }
  return trimmed;
}

export function assertEventWindow(startsAt: Date, endsAt: Date): void {
  if (!(endsAt > startsAt)) {
    throw new Error("End must be after start.");
  }
}

export function assertJoinUrl(value: string): string {
  const trimmed = value.trim();
  if (!isAllowedDestination(trimmed)) {
    throw new Error("Join destination must be an http(s) URL.");
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Join destination must be an http(s) URL.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Join destination")) {
      throw error;
    }
    throw new Error("Join destination must be an http(s) URL.");
  }
  return trimmed;
}

export function parseOptionalCapacity(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("Capacity must be empty or at least 1.");
  }
  return n;
}
