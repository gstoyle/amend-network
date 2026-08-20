import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

export type AudienceMarker = {
  label: string;
  restricted: boolean;
};

/**
 * Display names for the two programme visibility tokens. This module owns the
 * `all_authenticated | pathways | lead` vocabulary, so it owns what those tokens
 * are called, and every surface reads the names from here.
 */
export const PROGRAM_LABELS: Record<"pathways" | "lead", string> = {
  pathways: "Pathways to Change",
  lead: "LEAD",
};

/**
 * Describes who an entity is available to, for display beside content the caller
 * already receives. This is a label, never a gate: a member only ever sees rows
 * their own tokens intersect, so `restricted` selects a tone and nothing more.
 */
export function audienceLabel(visibility: string[]): AudienceMarker {
  if (visibility.includes("all_authenticated")) {
    return { label: "All members", restricted: false };
  }
  const pathways = visibility.includes("pathways");
  const lead = visibility.includes("lead");
  if (pathways && lead) {
    return {
      label: `${PROGRAM_LABELS.pathways} and ${PROGRAM_LABELS.lead}`,
      restricted: true,
    };
  }
  if (pathways) {
    return { label: `${PROGRAM_LABELS.pathways} only`, restricted: true };
  }
  if (lead) {
    return { label: `${PROGRAM_LABELS.lead} only`, restricted: true };
  }
  return { label: "Restricted", restricted: true };
}

export function visibilityTokens(claims: SessionClaims): string[] {
  if (claims.status !== "active") {
    return [];
  }
  const tokens = new Set<string>(["all_authenticated"]);
  switch (claims.programRole) {
    case "pathways":
      tokens.add("pathways");
      break;
    case "lead":
      tokens.add("lead");
      break;
    case "none":
      break;
    default: {
      const _exhaustive: never = claims.programRole;
      return _exhaustive;
    }
  }
  switch (claims.adminRole) {
    case "moderator":
      tokens.add("pathways");
      tokens.add("lead");
      break;
    case "super_admin":
    case "admin":
    case "none":
      break;
    default: {
      const _exhaustive: never = claims.adminRole;
      return _exhaustive;
    }
  }
  return [...tokens];
}

export async function listVisibleRecords(claims: SessionClaims) {
  const tokens = visibilityTokens(claims);
  if (tokens.length === 0) {
    return [];
  }
  return withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) =>
      tx.visibilityRecord.findMany({
        where: { visibility: { hasSome: tokens } },
        orderBy: { title: "asc" },
      }),
  );
}
