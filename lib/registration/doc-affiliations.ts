import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

const AFFILIATION_ROLES = ["admin", "super_admin"] as const;

const labelSchema = z.string().trim().min(1).max(120);
const idSchema = z.string().uuid();

export type DocAffiliationRecord = {
  id: string;
  label: string;
  active: boolean;
};

export type DocAffiliationWriteOptions = {
  ip: string;
  userAgent: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

function authorizeManager(
  session: SessionClaims | null,
  options: Pick<DocAffiliationWriteOptions, "clientAdminRole" | "clientMfaSatisfied">,
): SessionClaims {
  return requireRole(session, {
    admin: [...AFFILIATION_ROLES],
    mfa: true,
    clientAdminRole: options.clientAdminRole,
    clientMfaSatisfied: options.clientMfaSatisfied,
  });
}

async function writeSettingChange(
  tx: Prisma.TransactionClient,
  input: {
    session: SessionClaims;
    entityId: string;
    op: "add" | "edit" | "deactivate";
    ip: string;
    userAgent: string;
  },
): Promise<void> {
  await writeAudit(tx, {
    actorUserId: input.session.userId,
    actorRole: actorRole(input.session),
    action: "system_setting_changed",
    entityType: "doc_affiliation",
    entityId: input.entityId,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { setting: "doc_affiliation", op: input.op },
    severity: "info",
  });
}

export async function listActiveDocAffiliations(): Promise<
  Pick<DocAffiliationRecord, "id" | "label">[]
> {
  return withRls({}, async (tx) =>
    tx.docAffiliation.findMany({
      where: { active: true },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
  );
}

export async function listAllDocAffiliations(
  session: SessionClaims | null,
  options: Pick<DocAffiliationWriteOptions, "clientAdminRole" | "clientMfaSatisfied"> = {},
): Promise<DocAffiliationRecord[]> {
  const authorized = authorizeManager(session, options);
  return withRls(
    {
      userId: authorized.userId,
      programRole: authorized.programRole,
      adminRole: authorized.adminRole,
      status: authorized.status,
    },
    async (tx) =>
      tx.docAffiliation.findMany({
        orderBy: { label: "asc" },
        select: { id: true, label: true, active: true },
      }),
  );
}

export async function addDocAffiliation(
  session: SessionClaims | null,
  input: DocAffiliationWriteOptions & { label: string },
): Promise<DocAffiliationRecord> {
  const authorized = authorizeManager(session, input);
  const label = labelSchema.parse(input.label);
  try {
    return await withRls(
      {
        userId: authorized.userId,
        programRole: authorized.programRole,
        adminRole: authorized.adminRole,
        status: authorized.status,
      },
      async (tx) => {
        const row = await tx.docAffiliation.create({
          data: { label, createdBy: authorized.userId },
          select: { id: true, label: true, active: true },
        });
        await writeSettingChange(tx, {
          session: authorized,
          entityId: row.id,
          op: "add",
          ip: input.ip,
          userAgent: input.userAgent,
        });
        return row;
      },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("duplicate_label");
    }
    throw error;
  }
}

export async function editDocAffiliation(
  session: SessionClaims | null,
  input: DocAffiliationWriteOptions & { id: string; label: string },
): Promise<DocAffiliationRecord> {
  const authorized = authorizeManager(session, input);
  const id = idSchema.parse(input.id);
  const label = labelSchema.parse(input.label);
  try {
    return await withRls(
      {
        userId: authorized.userId,
        programRole: authorized.programRole,
        adminRole: authorized.adminRole,
        status: authorized.status,
      },
      async (tx) => {
        const row = await tx.docAffiliation.update({
          where: { id },
          data: { label },
          select: { id: true, label: true, active: true },
        });
        await writeSettingChange(tx, {
          session: authorized,
          entityId: row.id,
          op: "edit",
          ip: input.ip,
          userAgent: input.userAgent,
        });
        return row;
      },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("duplicate_label");
    }
    throw error;
  }
}

export async function deactivateDocAffiliation(
  session: SessionClaims | null,
  input: DocAffiliationWriteOptions & { id: string },
): Promise<DocAffiliationRecord> {
  const authorized = authorizeManager(session, input);
  const id = idSchema.parse(input.id);
  return withRls(
    {
      userId: authorized.userId,
      programRole: authorized.programRole,
      adminRole: authorized.adminRole,
      status: authorized.status,
    },
    async (tx) => {
      const row = await tx.docAffiliation.update({
        where: { id },
        data: { active: false },
        select: { id: true, label: true, active: true },
      });
      await writeSettingChange(tx, {
        session: authorized,
        entityId: row.id,
        op: "deactivate",
        ip: input.ip,
        userAgent: input.userAgent,
      });
      return row;
    },
  );
}
