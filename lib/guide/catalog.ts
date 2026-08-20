import type { SessionClaims } from "@/lib/auth/types";
import { GUIDE_ARTICLES } from "@/lib/guide/articles";
import type { GuideArticle, GuideAudience, GuideBlock, GuideCategory } from "@/lib/guide/types";

export const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    id: "start",
    title: "Getting started",
    summary: "Sign in, find your way around, and stay signed in safely.",
  },
  {
    id: "library",
    title: "Library and calendar",
    summary: "Resources you can open, and events you can attend.",
  },
  {
    id: "community",
    title: "Community",
    summary: "Forum rooms, directory listings, and the rules that apply there.",
  },
  {
    id: "account",
    title: "Your account",
    summary: "Privacy, sessions, and what your role can see.",
  },
  {
    id: "staff",
    title: "Staff tools",
    summary: "Publishing, moderation, and member administration.",
  },
];

function canViewAudience(claims: SessionClaims, audience: GuideAudience): boolean {
  switch (audience) {
    case "member":
      return true;
    case "staff":
      return claims.adminRole !== "none";
    case "content_admin":
      return claims.adminRole === "admin" || claims.adminRole === "super_admin";
    default: {
      const exhaustive: never = audience;
      return exhaustive;
    }
  }
}

function blockText(block: GuideBlock): string {
  switch (block.type) {
    case "p":
      return block.text;
    case "ul":
    case "ol":
      return block.items.join(" ");
    case "h2":
      return block.text;
    case "callout":
      return `${block.title} ${block.text}`;
    case "steps":
      return block.items.map((item) => `${item.title} ${item.text}`).join(" ");
    case "links":
      return block.items
        .map((item) => `${item.label} ${item.description ?? ""}`)
        .join(" ");
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

function searchableText(article: GuideArticle): string {
  return [
    article.title,
    article.summary,
    article.keywords.join(" "),
    ...article.blocks.map(blockText),
  ]
    .join(" ")
    .toLowerCase();
}

export function listVisibleGuideArticles(claims: SessionClaims): GuideArticle[] {
  return GUIDE_ARTICLES.filter((article) => canViewAudience(claims, article.audience));
}

export function getVisibleGuideArticle(
  claims: SessionClaims,
  slug: string,
): GuideArticle | null {
  const article = GUIDE_ARTICLES.find((entry) => entry.slug === slug);
  if (!article || !canViewAudience(claims, article.audience)) {
    return null;
  }
  return article;
}

function tokensFrom(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

export function searchGuideArticles(claims: SessionClaims, query: string): GuideArticle[] {
  const visible = listVisibleGuideArticles(claims);
  const tokens = tokensFrom(query);
  if (tokens.length === 0) {
    return visible;
  }
  return visible.filter((article) => {
    const haystack = new Set(tokensFrom(searchableText(article)));
    return tokens.every((token) => haystack.has(token));
  });
}

export function articlesByCategory(
  articles: GuideArticle[],
): { category: GuideCategory; articles: GuideArticle[] }[] {
  return GUIDE_CATEGORIES.flatMap((category) => {
    const grouped = articles.filter((article) => article.category === category.id);
    return grouped.length === 0 ? [] : [{ category, articles: grouped }];
  });
}

export function neighboringArticles(
  claims: SessionClaims,
  slug: string,
): { previous: GuideArticle | null; next: GuideArticle | null } {
  const visible = listVisibleGuideArticles(claims);
  const index = visible.findIndex((article) => article.slug === slug);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: visible[index - 1] ?? null,
    next: visible[index + 1] ?? null,
  };
}

export function relatedArticles(claims: SessionClaims, article: GuideArticle): GuideArticle[] {
  return listVisibleGuideArticles(claims)
    .filter((entry) => entry.category === article.category && entry.slug !== article.slug)
    .slice(0, 3);
}

export function headingLinks(article: GuideArticle): { id: string; text: string }[] {
  return article.blocks.flatMap((block) =>
    block.type === "h2" ? [{ id: block.id, text: block.text }] : [],
  );
}
