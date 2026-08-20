import { track } from "@/lib/analytics/track";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { visibilityTokens } from "@/lib/db/visibility";

export type MemberBanner = {
  id: string;
  headline: string;
  body: string;
  dismissible: boolean;
  ctaPrimaryLabel: string | null;
  ctaSecondaryLabel: string | null;
  /** When the announcement became visible, which is what a reader understands
   * as its posted date. Authoring time would mislead on a scheduled banner. */
  postedAt: Date;
};

export async function listEligibleBanners(
  session: SessionClaims | null,
): Promise<MemberBanner[]> {
  const claims = requireRole(session);
  const tokens = visibilityTokens(claims);
  if (tokens.length === 0) {
    return [];
  }
  const now = new Date();
  const rows = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const found = await tx.announcement.findMany({
        where: {
          deletedAt: null,
          activatesAt: { lte: now },
          expiresAt: { gte: now },
          visibility: { hasSome: tokens },
          dismissals: { none: { userId: claims.userId } },
        },
        orderBy: [{ activatesAt: "desc" }, { id: "desc" }],
        take: 2,
        select: {
          id: true,
          headline: true,
          body: true,
          dismissible: true,
          ctaPrimaryLabel: true,
          ctaSecondaryLabel: true,
          activatesAt: true,
        },
      });
      for (const row of found) {
        const inserted = await tx.$executeRaw`
          INSERT INTO announcement_impressions (user_id, announcement_id, created_at)
          VALUES (${claims.userId}::uuid, ${row.id}::uuid, CURRENT_TIMESTAMP)
          ON CONFLICT DO NOTHING
        `;
        if (Number(inserted) > 0) {
          track("announcement_impression", {
            distinctId: claims.userId,
            programRole: claims.programRole,
            adminRole: claims.adminRole,
            announcementId: row.id,
          });
        }
      }
      return found;
    },
  );
  return rows.map(({ activatesAt, ...banner }) => ({ ...banner, postedAt: activatesAt }));
}
