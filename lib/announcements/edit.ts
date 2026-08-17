import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import {
  type AnnouncementWriteInput,
  type AnnouncementWriteResult,
} from "@/lib/announcements/publish";
import {
  assertAnnouncementBody,
  parseCtaPair,
  parseVisibility,
} from "@/lib/announcements/validate";

const ADMIN_ROLES = ["admin", "super_admin"] as const;

export async function updateAnnouncement(
  session: SessionClaims | null,
  id: string,
  input: AnnouncementWriteInput,
): Promise<AnnouncementWriteResult> {
  const claims = requireRole(session, { admin: [...ADMIN_ROLES], mfa: true });
  let headline: string;
  let body: string;
  let visibility: string[];
  let activatesAt: Date;
  let expiresAt: Date;
  let dismissible: boolean;
  let primary: { label: string; url: string } | null;
  let secondary: { label: string; url: string } | null;
  try {
    headline = input.headline.trim();
    if (headline.length < 1 || headline.length > 120) {
      throw new Error("Headline must be 1 to 120 characters.");
    }
    body = assertAnnouncementBody(input.body);
    visibility = parseVisibility(input.visibility);
    activatesAt = new Date(input.activatesAt);
    expiresAt = new Date(input.expiresAt);
    if (!(expiresAt > activatesAt)) {
      throw new Error("Expiry must be after activation.");
    }
    dismissible = input.dismissible ?? true;
    primary = parseCtaPair(input.ctaPrimaryLabel, input.ctaPrimaryUrl);
    secondary = parseCtaPair(input.ctaSecondaryLabel, input.ctaSecondaryUrl);
    if (secondary && !primary) {
      throw new Error("Add a first call to action before a second.");
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save this announcement." };
  }

  const updated = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const existing = await tx.announcement.findUnique({ where: { id } });
      if (!existing) {
        return false;
      }
      await tx.announcement.update({
        where: { id },
        data: {
          headline,
          body,
          visibility,
          activatesAt,
          expiresAt,
          dismissible,
          ctaPrimaryLabel: primary?.label ?? null,
          ctaPrimaryUrl: primary?.url ?? null,
          ctaSecondaryLabel: secondary?.label ?? null,
          ctaSecondaryUrl: secondary?.url ?? null,
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: claims.adminRole,
        action: "announcement_edited",
        entityType: "announcement",
        entityId: id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { visibility },
        severity: "info",
      });
      return true;
    },
  );
  if (!updated) {
    return { ok: false, error: "Could not save this announcement." };
  }
  return { ok: true, id };
}

export async function withdrawAnnouncement(
  session: SessionClaims | null,
  id: string,
  context: { ip: string; userAgent: string },
): Promise<boolean> {
  const claims = requireRole(session, { admin: [...ADMIN_ROLES], mfa: true });
  return withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const existing = await tx.announcement.findUnique({ where: { id } });
      if (!existing) {
        return false;
      }
      if (existing.deletedAt) {
        return true;
      }
      await tx.announcement.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: claims.adminRole,
        action: "announcement_deleted",
        entityType: "announcement",
        entityId: id,
        ip: context.ip,
        userAgent: context.userAgent,
        severity: "info",
      });
      return true;
    },
  );
}
