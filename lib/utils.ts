import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Fixed to UTC so a server render and a test assertion never disagree. Viewer-local
 * times belong in the existing client-side time components, not in card metadata.
 */
export function formatDayMonthYear(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(value);
}
