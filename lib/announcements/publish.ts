import { randomUUID } from "node:crypto";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import {
  assertAnnouncementBody,
  parseCtaPair,
  parseVisibility,
} from "@/lib/announcements/validate";

const ADMIN_ROLES = ["admin", "super_admin"] as const;

const createSchema = z
  .object({
    headline: z.string().trim().min(1).max(120),
    body: z.string(),
    visibility: z.array(z.string()),
    activatesAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    dismissible: z.boolean().optional(),
    ctaPrimaryLabel: z.string().optional(),
    ctaPrimaryUrl: z.string().optional(),
    ctaSecondaryLabel: z.string().optional(),
    ctaSecondaryUrl: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!(value.expiresAt > value.activatesAt)) {
      ctx.addIssue({
        code: "custom",
        message: "Expiry must be after activation.",
      });
    }
  });

export type AnnouncementWriteInput = {
  headline: string;
  body: string;
  visibility: string[];
  activatesAt: Date | string;
  expiresAt: Date | string;
  dismissible?: boolean;
  ctaPrimaryLabel?: string;
  ctaPrimaryUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  ip: string;
  userAgent: string;
};

export type AnnouncementWriteResult = { ok: true; id: string } | { ok: false; error: string };

function authorizeAdmin(session: SessionClaims | null): SessionClaims {
  return requireRole(session, { admin: [...ADMIN_ROLES], mfa: true });
}

function parsedFields(input: AnnouncementWriteInput) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not save this announcement.");
  }
  const body = assertAnnouncementBody(parsed.data.body);
  const visibility = parseVisibility(parsed.data.visibility);
  const primary = parseCtaPair(input.ctaPrimaryLabel, input.ctaPrimaryUrl);
  const secondary = parseCtaPair(input.ctaSecondaryLabel, input.ctaSecondaryUrl);
  if (secondary && !primary) {
    throw new Error("Add a first call to action before a second.");
  }
  return {
    headline: parsed.data.headline,
    body,
    visibility,
    activatesAt: parsed.data.activatesAt,
    expiresAt: parsed.data.expiresAt,
    dismissible: parsed.data.dismissible ?? true,
    primary,
    secondary,
  };
}

export async function createAnnouncement(
  session: SessionClaims | null,
  input: AnnouncementWriteInput,
): Promise<AnnouncementWriteResult> {
  const claims = authorizeAdmin(session);
  let fields;
  try {
    fields = parsedFields(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save this announcement." };
  }
  const id = randomUUID();
  await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      await tx.announcement.create({
        data: {
          id,
          headline: fields.headline,
          body: fields.body,
          visibility: fields.visibility,
          activatesAt: fields.activatesAt,
          expiresAt: fields.expiresAt,
          dismissible: fields.dismissible,
          createdBy: claims.userId,
          ctaPrimaryLabel: fields.primary?.label ?? null,
          ctaPrimaryUrl: fields.primary?.url ?? null,
          ctaSecondaryLabel: fields.secondary?.label ?? null,
          ctaSecondaryUrl: fields.secondary?.url ?? null,
        },
      });
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: claims.adminRole,
        action: "announcement_created",
        entityType: "announcement",
        entityId: id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { visibility: fields.visibility },
        severity: "info",
      });
    },
  );
  return { ok: true, id };
}

export type AdminAnnouncement = {
  id: string;
  headline: string;
  body: string;
  visibility: string[];
  activatesAt: Date;
  expiresAt: Date;
  dismissible: boolean;
  deletedAt: Date | null;
  ctaPrimaryLabel: string | null;
  ctaPrimaryUrl: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryUrl: string | null;
  status: "scheduled" | "active" | "expired" | "withdrawn";
};

export function derivedStatus(
  row: { activatesAt: Date; expiresAt: Date; deletedAt: Date | null },
  now = new Date(),
): AdminAnnouncement["status"] {
  if (row.deletedAt) {
    return "withdrawn";
  }
  if (now < row.activatesAt) {
    return "scheduled";
  }
  if (now > row.expiresAt) {
    return "expired";
  }
  return "active";
}

export async function listAdminAnnouncements(
  session: SessionClaims | null,
  filter?: { status?: AdminAnnouncement["status"] },
): Promise<AdminAnnouncement[]> {
  const claims = authorizeAdmin(session);
  const rows = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) => tx.announcement.findMany({ orderBy: [{ activatesAt: "desc" }, { id: "desc" }] }),
  );
  return rows
    .map((row) => ({
      id: row.id,
      headline: row.headline,
      body: row.body,
      visibility: row.visibility,
      activatesAt: row.activatesAt,
      expiresAt: row.expiresAt,
      dismissible: row.dismissible,
      deletedAt: row.deletedAt,
      ctaPrimaryLabel: row.ctaPrimaryLabel,
      ctaPrimaryUrl: row.ctaPrimaryUrl,
      ctaSecondaryLabel: row.ctaSecondaryLabel,
      ctaSecondaryUrl: row.ctaSecondaryUrl,
      status: derivedStatus(row),
    }))
    .filter((row) => (filter?.status ? row.status === filter.status : true));
}

export async function getAdminAnnouncement(
  session: SessionClaims | null,
  id: string,
): Promise<AdminAnnouncement | null> {
  const claims = authorizeAdmin(session);
  const row = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) => tx.announcement.findUnique({ where: { id } }),
  );
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    headline: row.headline,
    body: row.body,
    visibility: row.visibility,
    activatesAt: row.activatesAt,
    expiresAt: row.expiresAt,
    dismissible: row.dismissible,
    deletedAt: row.deletedAt,
    ctaPrimaryLabel: row.ctaPrimaryLabel,
    ctaPrimaryUrl: row.ctaPrimaryUrl,
    ctaSecondaryLabel: row.ctaSecondaryLabel,
    ctaSecondaryUrl: row.ctaSecondaryUrl,
    status: derivedStatus(row),
  };
}
