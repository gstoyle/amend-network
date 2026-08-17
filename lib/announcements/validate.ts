const VISIBILITY = ["all_authenticated", "pathways", "lead"] as const;

export type VisibilityToken = (typeof VISIBILITY)[number];

export function isAllowedDestination(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("/app/") && !trimmed.includes("://") && !trimmed.startsWith("//")) {
    return trimmed.length > 5;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function assertAnnouncementBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) {
    throw new Error("Body must be 1 to 1,000 characters.");
  }
  if (trimmed.includes("<") || trimmed.includes(">")) {
    throw new Error("Body cannot include HTML.");
  }
  return trimmed;
}

export function parseCtaPair(
  label: unknown,
  url: unknown,
): { label: string; url: string } | null {
  const labelText = typeof label === "string" ? label.trim() : "";
  const urlText = typeof url === "string" ? url.trim() : "";
  if (!labelText && !urlText) {
    return null;
  }
  if (!labelText || !urlText) {
    throw new Error("Each call to action needs both a label and a destination.");
  }
  if (labelText.length > 40) {
    throw new Error("Call-to-action labels must be 40 characters or fewer.");
  }
  if (!isAllowedDestination(urlText)) {
    throw new Error("Call-to-action destinations must be http(s) or an in-app /app/ path.");
  }
  return { label: labelText, url: urlText };
}

export function parseVisibility(values: string[]): VisibilityToken[] {
  const unique = [...new Set(values)];
  if (unique.length < 1) {
    throw new Error("Choose at least one visibility value.");
  }
  for (const value of unique) {
    if (!(VISIBILITY as readonly string[]).includes(value)) {
      throw new Error("Choose a valid visibility value.");
    }
  }
  return unique as VisibilityToken[];
}

export type BodySegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "emphasis"; value: string }
  | { type: "link"; label: string; href: string };

export function parseAnnouncementBody(source: string): BodySegment[] {
  const segments: BodySegment[] = [];
  const pattern =
    /\*\*(.+?)\*\*|_(.+?)_|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match = pattern.exec(source);
  while (match) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: source.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "bold", value: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: "emphasis", value: match[2] });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const href = match[4].trim();
      if (isAllowedDestination(href)) {
        segments.push({ type: "link", label: match[3], href });
      } else {
        segments.push({ type: "text", value: match[0] });
      }
    }
    lastIndex = match.index + match[0].length;
    match = pattern.exec(source);
  }
  if (lastIndex < source.length) {
    segments.push({ type: "text", value: source.slice(lastIndex) });
  }
  return segments;
}
