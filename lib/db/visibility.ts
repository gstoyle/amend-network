import type { ProgramRole, SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { PROGRAM_LABELS } from "@/lib/db/program-labels";

export type AudienceMarker = {
  label: string;
  restricted: boolean;
};

export {
  IMMERSION_NETWORK_NAME,
  LEAD_NETWORK_NAME,
  PROGRAM_LABELS,
  VISIBILITY_OPTIONS,
  isProgramNetworkRole,
} from "@/lib/db/program-labels";

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

export function memberProgramRoles(
  primary: ProgramRole,
  extra: Iterable<ProgramRole> = [],
): Array<"pathways" | "lead"> {
  const roles = new Set<"pathways" | "lead">();
  const add = (role: ProgramRole): void => {
    switch (role) {
      case "pathways":
      case "lead":
        roles.add(role);
        break;
      case "none":
        break;
      default: {
        const _exhaustive: never = role;
        void _exhaustive;
      }
    }
  };
  add(primary);
  for (const role of extra) {
    add(role);
  }
  return [...roles];
}

export function visibilityTokens(claims: SessionClaims): string[] {
  if (claims.status !== "active") {
    return [];
  }
  const tokens = new Set<string>(["all_authenticated"]);
  for (const role of memberProgramRoles(claims.programRole, claims.programRoles ?? [])) {
    tokens.add(role);
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
