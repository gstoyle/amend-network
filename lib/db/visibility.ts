import type { Prisma } from "@prisma/client";
import type { ProgramRole, SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import {
  cohortIdFromToken,
  cohortToken,
  isCohortToken,
  PROGRAM_LABELS,
  VISIBILITY_COHORT_UNAVAILABLE_MESSAGE,
} from "@/lib/db/program-labels";

export type AudienceMarker = {
  label: string;
  restricted: boolean;
};

/**
 * Every cohort named must exist. Cohorts the item did not already target must be active,
 * so an archived cohort can stay on an item but cannot be newly added.
 */
export async function assertCohortTargets(
  tx: Prisma.TransactionClient,
  next: readonly string[],
  previous: readonly string[] = [],
): Promise<void> {
  const ids = next.filter(isCohortToken).map(cohortIdFromToken);
  if (ids.length === 0) {
    return;
  }
  const kept = new Set(previous.filter(isCohortToken).map(cohortIdFromToken));
  const rows = await tx.network.findMany({
    where: { id: { in: ids }, programRole: { in: ["pathways", "lead"] } },
    select: { id: true, archivedAt: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row] as const));
  for (const id of ids) {
    const row = byId.get(id);
    if (!row || (row.archivedAt && !kept.has(id))) {
      throw new Error(VISIBILITY_COHORT_UNAVAILABLE_MESSAGE);
    }
  }
}

export type CohortNames = ReadonlyMap<string, string>;

/** Names for every cohort referenced by the given visibility arrays. */
export async function cohortNamesFor(
  tx: Prisma.TransactionClient,
  visibilities: ReadonlyArray<readonly string[]>,
): Promise<CohortNames> {
  const ids = new Set<string>();
  for (const visibility of visibilities) {
    for (const token of visibility) {
      if (isCohortToken(token)) {
        ids.add(cohortIdFromToken(token));
      }
    }
  }
  if (ids.size === 0) {
    return new Map();
  }
  const rows = await tx.network.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name] as const));
}

function joinNames(names: string[]): string {
  if (names.length <= 2) {
    return names.join(" and ");
  }
  if (names.length === 3) {
    return `${names[0]}, ${names[1]} and ${names[2]}`;
  }
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

export {
  IMMERSION_NETWORK_NAME,
  LEAD_NETWORK_NAME,
  PROGRAM_LABELS,
  VISIBILITY_COHORT_UNAVAILABLE_MESSAGE,
  VISIBILITY_EMPTY_MESSAGE,
  VISIBILITY_INVALID_MESSAGE,
  VISIBILITY_OPTIONS,
  cohortIdFromToken,
  cohortToken,
  isCohortToken,
  isProgramNetworkRole,
  parseVisibilityTokens,
  type CohortToken,
  type FixedVisibilityToken,
  type VisibilityToken,
} from "@/lib/db/program-labels";

/**
 * Describes who an entity is available to, for display beside content the caller
 * already receives. This is a label, never a gate: a member only ever sees rows
 * their own tokens intersect, so `restricted` selects a tone and nothing more.
 */
export function audienceLabel(
  visibility: readonly string[],
  cohortNames: CohortNames = new Map(),
): AudienceMarker {
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
  const cohorts = visibility.filter(isCohortToken);
  if (cohorts.length > 0) {
    const names = cohorts
      .map((token) => cohortNames.get(cohortIdFromToken(token)))
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b));
    if (names.length === 0) {
      return { label: "Selected cohorts", restricted: true };
    }
    return { label: `${joinNames(names)} only`, restricted: true };
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
  for (const cohortId of claims.cohortIds ?? []) {
    tokens.add(cohortToken(cohortId));
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
