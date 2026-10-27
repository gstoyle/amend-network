import { cache } from "react";
import { withRls } from "@/lib/db/rls";
import {
  cohortIdFromToken,
  cohortToken,
  isCohortToken,
  type VisibilityToken,
} from "@/lib/db/program-labels";
import type { CohortNames } from "@/lib/db/visibility";

export type CohortProgram = "pathways" | "lead";

export type CohortOption = {
  id: string;
  name: string;
  programRole: CohortProgram;
  archived: boolean;
};

export type AudienceSet = {
  /** Everything the group receives: `visibility && reach`. */
  reach: VisibilityToken[];
  /** Items aimed at the group specifically: `visibility && targeted`. */
  targeted: VisibilityToken[];
};

function isCohortProgram(role: string): role is CohortProgram {
  return role === "pathways" || role === "lead";
}

/** Cohort names keyed by id for audience labels. Network names are readable by every session. */
export const cohortNameMap = cache(async (): Promise<CohortNames> => {
  const rows = await withRls({}, (tx) =>
    tx.network.findMany({
      where: { programRole: { in: ["pathways", "lead"] } },
      select: { id: true, name: true },
    }),
  );
  return new Map(rows.map((row) => [row.id, row.name]));
});

export async function listCohortOptions(
  options: { includeArchived?: boolean } = {},
): Promise<CohortOption[]> {
  const rows = await withRls({}, (tx) =>
    tx.network.findMany({
      where: {
        programRole: { in: ["pathways", "lead"] },
        ...(options.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [{ programRole: "asc" }, { name: "asc" }],
      select: { id: true, name: true, programRole: true, archivedAt: true },
    }),
  );
  return rows.flatMap((row) =>
    isCohortProgram(row.programRole)
      ? [{ id: row.id, name: row.name, programRole: row.programRole, archived: row.archivedAt !== null }]
      : [],
  );
}

/**
 * Tokens for the admin group filter. `group` is a programme (`pathways`, `lead`) or a
 * cohort token. Anything else, including an unknown cohort, means no filter (null).
 */
export function audienceTokensForGroup(
  group: string | null | undefined,
  cohorts: readonly CohortOption[],
): AudienceSet | null {
  if (!group) {
    return null;
  }
  if (isCohortProgram(group)) {
    const programCohorts = cohorts
      .filter((cohort) => cohort.programRole === group)
      .map((cohort) => cohortToken(cohort.id));
    const targeted: VisibilityToken[] = [group, ...programCohorts];
    return { reach: ["all_authenticated", ...targeted], targeted };
  }
  const token = group.trim().toLowerCase();
  if (!isCohortToken(token)) {
    return null;
  }
  const cohort = cohorts.find((option) => option.id === cohortIdFromToken(token));
  if (!cohort) {
    return null;
  }
  return { reach: ["all_authenticated", cohort.programRole, token], targeted: [token] };
}
