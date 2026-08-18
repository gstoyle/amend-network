import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

export async function getRevealedJoinUrl(
  session: SessionClaims | null,
  eventId: string,
): Promise<string | null> {
  const claims = requireRole(session);
  const rows = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) =>
      tx.$queryRaw<{ url: string }[]>`
        SELECT url
        FROM event_join_links
        WHERE event_id = ${eventId}::uuid
          AND event_join_revealed(${eventId}::uuid)
      `,
  );
  return rows[0]?.url ?? null;
}
