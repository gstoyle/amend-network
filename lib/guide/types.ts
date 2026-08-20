export type GuideAudience = "member" | "staff" | "content_admin";

export type GuideCategoryId = "start" | "library" | "community" | "account" | "staff";

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "h2"; id: string; text: string }
  | { type: "callout"; tone: "note" | "warning"; title: string; text: string }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "links"; items: { href: string; label: string; description?: string }[] };

export type GuideArticle = {
  slug: string;
  title: string;
  summary: string;
  category: GuideCategoryId;
  audience: GuideAudience;
  keywords: string[];
  blocks: GuideBlock[];
};

export type GuideCategory = {
  id: GuideCategoryId;
  title: string;
  summary: string;
};
