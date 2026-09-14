/**
 * Display names and form options for the two programme visibility tokens.
 * Kept free of database imports so client forms can share the same labels.
 *
 * The `pathways` token is the International Immersion Program. The identifier
 * stays `pathways` in the database and RLS so existing rows and policies keep
 * working.
 */
export const PROGRAM_LABELS: Record<"pathways" | "lead", string> = {
  pathways: "International Immersion Program",
  lead: "LEAD",
};

/** First Immersion trip group. Further trips are additional `networks` rows with program_role = pathways. */
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
