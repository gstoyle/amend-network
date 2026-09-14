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
  | { type: "underline"; value: string }
  | { type: "emphasis"; value: string }
  | { type: "link"; label: string; href: string };

export type MarkdownWrap = "bold" | "italic" | "underline";

export type MarkdownSelection = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(value, length));
}

function markersFor(wrap: MarkdownWrap): { open: string; close: string } {
  switch (wrap) {
    case "bold":
      return { open: "**", close: "**" };
    case "italic":
      return { open: "_", close: "_" };
    case "underline":
      return { open: "++", close: "++" };
    default: {
      const _exhaustive: never = wrap;
      return _exhaustive;
    }
  }
}

export function wrapMarkdownSelection(
  source: string,
  start: number,
  end: number,
  wrap: MarkdownWrap,
): MarkdownSelection {
  const from = clampIndex(Math.min(start, end), source.length);
  const to = clampIndex(Math.max(start, end), source.length);
  const { open, close } = markersFor(wrap);
  const selected = source.slice(from, to);
  const wrappedSelected =
    selected.startsWith(open) &&
    selected.endsWith(close) &&
    selected.length >= open.length + close.length;
  const wrappedAround =
    source.slice(Math.max(0, from - open.length), from) === open &&
    source.slice(to, to + close.length) === close;

  if (wrappedSelected) {
    const inner = selected.slice(open.length, selected.length - close.length);
    return {
      value: `${source.slice(0, from)}${inner}${source.slice(to)}`,
      selectionStart: from,
      selectionEnd: from + inner.length,
    };
  }
  if (wrappedAround) {
    const nextStart = from - open.length;
    return {
      value: `${source.slice(0, nextStart)}${selected}${source.slice(to + close.length)}`,
      selectionStart: nextStart,
      selectionEnd: nextStart + selected.length,
    };
  }

  const insertion = `${open}${selected}${close}`;
  const innerStart = from + open.length;
  return {
    value: `${source.slice(0, from)}${insertion}${source.slice(to)}`,
    selectionStart: innerStart,
    selectionEnd: innerStart + selected.length,
  };
}

export function wrapMarkdownLink(
  source: string,
  start: number,
  end: number,
  href: string,
): MarkdownSelection | null {
  const trimmed = href.trim();
  if (!isAllowedDestination(trimmed)) {
    return null;
  }
  const from = clampIndex(Math.min(start, end), source.length);
  const to = clampIndex(Math.max(start, end), source.length);
  const label = source.slice(from, to) || "link text";
  const insertion = `[${label}](${trimmed})`;
  return {
    value: `${source.slice(0, from)}${insertion}${source.slice(to)}`,
    selectionStart: from + 1,
    selectionEnd: from + 1 + label.length,
  };
}

export function parseAnnouncementBody(source: string): BodySegment[] {
  const segments: BodySegment[] = [];
  const pattern =
    /\*\*(.+?)\*\*|\+\+(.+?)\+\+|_(.+?)_|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match = pattern.exec(source);
  while (match) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: source.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "bold", value: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: "underline", value: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "emphasis", value: match[3] });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      const href = match[5].trim();
      if (isAllowedDestination(href)) {
        segments.push({ type: "link", label: match[4], href });
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
