import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import {
  replaceResource as commitReplacement,
  type PublishResult,
  type ReplaceInput,
} from "@/lib/resources/publish";

const ADMIN_ROLES = ["admin", "super_admin"] as const;
const SOURCES = ["Amend", "Partner Org", "External"] as const;
const VISIBILITY = ["all_authenticated", "pathways", "lead"] as const;
const GENERIC_EDIT_ERROR = "Could not save this resource.";

const metadataSchema = z.object({
  resourceId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required."),
  previewText: z
    .string()
    .trim()
    .min(1, "Preview text is required.")
    .max(500, "Preview text must be 500 characters or fewer."),
  sourceLabel: z.enum(SOURCES, { message: "Choose a valid source label." }),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(10, "Use 10 tags or fewer."),
  visibility: z
    .array(z.enum(VISIBILITY))
    .min(1, "Choose at least one visibility value."),
});

export type { PublishResult, ReplaceInput };

export type EditInput = {
  resourceId: string;
  title: string;
  previewText: string;
  sourceLabel: string;
  tags: string[];
  visibility: string[];
  ip: string;
  userAgent: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

export type WithdrawInput = {
  resourceId: string;
  ip: string;
  userAgent: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

export type AdminResourceDetail = {
  id: string;
  title: string;
  previewText: string;
  sourceLabel: string;
  tags: string[];
  visibility: string[];
  deletedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
};

function authorizeEditor(
  session: SessionClaims | null,
  options: Pick<EditInput, "clientAdminRole" | "clientMfaSatisfied"> = {},
): SessionClaims {
  return requireRole(session, {
    admin: [...ADMIN_ROLES],
    mfa: true,
    clientAdminRole: options.clientAdminRole,
    clientMfaSatisfied: options.clientMfaSatisfied,
  });
}

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

export async function getAdminResource(
  session: SessionClaims | null,
  id: string,
  options: Pick<EditInput, "clientAdminRole" | "clientMfaSatisfied"> = {},
): Promise<AdminResourceDetail | null> {
  const claims = authorizeEditor(session, options);
  return withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const row = await tx.resource.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          previewText: true,
          sourceLabel: true,
          tags: true,
          visibility: true,
          deletedAt: true,
          updatedAt: true,
          createdAt: true,
        },
      });
      return row;
    },
  );
}

export async function updateResource(
  session: SessionClaims | null,
  input: EditInput,
): Promise<PublishResult> {
  const claims = authorizeEditor(session, input);
  const parsed = metadataSchema.safeParse({
    resourceId: input.resourceId,
    title: input.title,
    previewText: input.previewText,
    sourceLabel: input.sourceLabel,
    tags: input.tags,
    visibility: input.visibility,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Check the required fields.";
    return { ok: false, error: first };
  }

  try {
    const updated = await withRls(
      {
        userId: claims.userId,
        programRole: claims.programRole,
        adminRole: claims.adminRole,
        status: claims.status,
      },
      async (tx) => {
        const existing = await tx.resource.findUnique({
          where: { id: parsed.data.resourceId },
          select: { id: true, deletedAt: true },
        });
        if (!existing || existing.deletedAt) {
          return null;
        }
        await tx.resource.update({
          where: { id: existing.id },
          data: {
            title: parsed.data.title,
            previewText: parsed.data.previewText,
            sourceLabel: parsed.data.sourceLabel,
            tags: parsed.data.tags,
            visibility: parsed.data.visibility,
          },
        });
        await writeAudit(tx, {
          actorUserId: claims.userId,
          actorRole: actorRole(claims),
          action: "resource_edited",
          entityType: "resource",
          entityId: existing.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: {},
          severity: "info",
        });
        return existing.id;
      },
    );
    if (!updated) {
      return { ok: false, error: GENERIC_EDIT_ERROR };
    }
    return { ok: true, id: updated };
  } catch {
    return { ok: false, error: GENERIC_EDIT_ERROR };
  }
}

export async function replaceResource(
  session: SessionClaims | null,
  input: ReplaceInput,
): Promise<PublishResult> {
  return commitReplacement(session, input);
}

export async function withdrawResource(
  session: SessionClaims | null,
  input: WithdrawInput,
): Promise<PublishResult> {
  const claims = authorizeEditor(session, input);
  const parsed = z.string().uuid().safeParse(input.resourceId);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_EDIT_ERROR };
  }

  try {
    const withdrawn = await withRls(
      {
        userId: claims.userId,
        programRole: claims.programRole,
        adminRole: claims.adminRole,
        status: claims.status,
      },
      async (tx) => {
        const existing = await tx.resource.findUnique({
          where: { id: parsed.data },
          select: { id: true, deletedAt: true },
        });
        if (!existing) {
          return null;
        }
        if (existing.deletedAt) {
          return existing.id;
        }
        await tx.resource.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        });
        await writeAudit(tx, {
          actorUserId: claims.userId,
          actorRole: actorRole(claims),
          action: "resource_deleted",
          entityType: "resource",
          entityId: existing.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: {},
          severity: "info",
        });
        return existing.id;
      },
    );
    if (!withdrawn) {
      return { ok: false, error: GENERIC_EDIT_ERROR };
    }
    return { ok: true, id: withdrawn };
  } catch {
    return { ok: false, error: GENERIC_EDIT_ERROR };
  }
}
