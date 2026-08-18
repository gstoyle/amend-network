import { z } from "zod";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import type { AdminAnalyticsSnapshot } from "@/lib/admin-analytics/types";

const UNKNOWN_NETWORK_ID = "00000000-0000-0000-0000-000000000000";
const networkIdSchema = z.string().uuid();

export function parseAnalyticsNetworkQuery(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || value === "" || value === "all") {
    return null;
  }
  const parsed = networkIdSchema.safeParse(value);
  if (!parsed.success) {
    return UNKNOWN_NETWORK_ID;
  }
  return parsed.data;
}

export type LoadAdminAnalyticsOptions = {
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

function parseSnapshot(raw: unknown): AdminAnalyticsSnapshot {
  const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed) || !("kpis" in parsed)) {
    throw new AuthDeniedError();
  }
  return parsed as AdminAnalyticsSnapshot;
}

export async function loadAdminAnalytics(
  session: SessionClaims | null,
  networkId: string | null,
  options: LoadAdminAnalyticsOptions = {},
): Promise<AdminAnalyticsSnapshot> {
  const authorized = requireRole(session, {
    admin: ["admin", "super_admin"],
    mfa: true,
    clientAdminRole: options.clientAdminRole,
    clientMfaSatisfied: options.clientMfaSatisfied,
  });

  const rows = await withRls(
    {
      userId: authorized.userId,
      programRole: authorized.programRole,
      adminRole: authorized.adminRole,
      status: authorized.status,
    },
    (tx) =>
      tx.$queryRaw<{ snapshot: unknown }[]>`
        SELECT admin_analytics_snapshot(${networkId}::uuid) AS snapshot
      `,
  );

  return parseSnapshot(rows[0]?.snapshot);
}
