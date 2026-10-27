import { z } from "zod";

/**
 * Display names, form options, and token parsing for visibility.
 * Kept free of database imports so client forms can share the same rules.
 *
 * The `pathways` token is Global Learning Experiences (domestic and
 * international). The identifier stays `pathways` in the database and RLS
 * so existing rows and policies keep working.
 */
export const PROGRAM_LABELS: Record<"pathways" | "lead", string> = {
  pathways: "Global Learning Experiences",
  lead: "LEAD",
};

/** First Global Learning Experiences trip group. Further trips are additional `networks` rows with program_role = pathways. */
export const IMMERSION_NETWORK_NAME = "Norway & Northern Ireland | Fall 2026";
export const LEAD_NETWORK_NAME = "LEAD";

export const VISIBILITY_OPTIONS = [
  { value: "all_authenticated", label: "Everyone signed in" },
  { value: "pathways", label: `${PROGRAM_LABELS.pathways} only` },
  { value: "lead", label: `${PROGRAM_LABELS.lead} only` },
] as const;

export function isProgramNetworkRole(role: string): boolean {
  return role === "pathways" || role === "lead";
}

const FIXED_TOKENS = ["all_authenticated", "pathways", "lead"] as const;
const COHORT_PREFIX = "cohort:";
const COHORT_TOKEN = /^cohort:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type FixedVisibilityToken = (typeof FIXED_TOKENS)[number];
export type CohortToken = `cohort:${string}`;
export type VisibilityToken = FixedVisibilityToken | CohortToken;

export const VISIBILITY_INVALID_MESSAGE = "Choose a valid visibility value.";
export const VISIBILITY_EMPTY_MESSAGE = "Choose at least one visibility value.";
export const VISIBILITY_COHORT_UNAVAILABLE_MESSAGE =
  "One of the chosen cohorts is archived or no longer exists.";

export function cohortToken(cohortId: string): CohortToken {
  return `${COHORT_PREFIX}${cohortId.toLowerCase()}`;
}

export function isCohortToken(token: string): token is CohortToken {
  return COHORT_TOKEN.test(token);
}

export function cohortIdFromToken(token: CohortToken): string {
  return token.slice(COHORT_PREFIX.length);
}

const tokenSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (value) => (FIXED_TOKENS as readonly string[]).includes(value) || COHORT_TOKEN.test(value),
    VISIBILITY_INVALID_MESSAGE,
  );

/** Shape check only. Cohort existence is checked by `assertCohortTargets` inside the write. */
export function parseVisibilityTokens(values: readonly unknown[]): VisibilityToken[] {
  const unique = new Set<VisibilityToken>();
  for (const value of values) {
    const parsed = tokenSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(VISIBILITY_INVALID_MESSAGE);
    }
    unique.add(parsed.data as VisibilityToken);
  }
  if (unique.size < 1) {
    throw new Error(VISIBILITY_EMPTY_MESSAGE);
  }
  return [...unique];
}

export const visibilityTokensSchema = z
  .array(z.string())
  .min(1, VISIBILITY_EMPTY_MESSAGE)
  .transform((values, ctx) => {
    try {
      return parseVisibilityTokens(values);
    } catch {
      ctx.addIssue({ code: "custom", message: VISIBILITY_INVALID_MESSAGE });
      return z.NEVER;
    }
  });
