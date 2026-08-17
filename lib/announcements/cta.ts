import { track } from "@/lib/analytics/track";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

export type CtaSlot = "primary" | "secondary";

export async function recordAnnouncementCtaClick(
  session: SessionClaims | null,
  announcementId: string,
  slot: string,
): Promise<string | null> {
  if (slot !== "primary" && slot !== "secondary") {
    return null;
  }
  const claims = requireRole(session);
  return withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const row = await tx.announcement.findUnique({ where: { id: announcementId } });
      const now = new Date();
      if (
        !row ||
        row.deletedAt ||
        now < row.activatesAt ||
        now > row.expiresAt
      ) {
        return null;
      }
      const destination = slot === "primary" ? row.ctaPrimaryUrl : row.ctaSecondaryUrl;
      if (!destination) {
        return null;
      }
      const inserted = await tx.$executeRaw`
        INSERT INTO announcement_cta_clicks (user_id, announcement_id, slot, created_at)
        VALUES (${claims.userId}::uuid, ${announcementId}::uuid, ${slot}, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
      `;
      if (Number(inserted) > 0) {
        track("announcement_cta_click", {
          distinctId: claims.userId,
          programRole: claims.programRole,
          adminRole: claims.adminRole,
          announcementId,
          ctaSlot: slot,
        });
      }
      return destination;
    },
  );
}
