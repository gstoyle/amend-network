import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

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
