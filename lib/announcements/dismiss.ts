import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

export async function dismissAnnouncement(
  session: SessionClaims | null,
  announcementId: string,
): Promise<boolean> {
  const claims = requireRole(session);
  try {
    await withRls(
      {
        userId: claims.userId,
        programRole: claims.programRole,
        adminRole: claims.adminRole,
        status: claims.status,
      },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO announcement_dismissals (user_id, announcement_id, dismissed_at)
          VALUES (${claims.userId}::uuid, ${announcementId}::uuid, CURRENT_TIMESTAMP)
          ON CONFLICT DO NOTHING
        `,
    );
    return true;
  } catch {
    return false;
  }
}
