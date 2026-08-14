import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_TAKE = 50;

export type ListAuditLogOptions = {
  cursor?: string;
  take?: number;
  ip?: string;
  userAgent?: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

export type AuditLogRow = {
  id: string;
  createdAt: string;
  actorRole: string;
  action: string;
  entityType: string | null;
  severity: string;
};

export type AuditLogPage = {
  rows: AuditLogRow[];
  nextCursor: string | null;
};

function windowWhere(adminRole: SessionClaims["adminRole"]): Prisma.AuditLogWhereInput {
  switch (adminRole) {
    case "super_admin":
      return {};
    case "admin":
      return { createdAt: { gte: new Date(Date.now() - NINETY_DAYS_MS) } };
    case "moderator":
    case "none":
      return { id: { in: [] } };
    default: {
      const _exhaustive: never = adminRole;
      return _exhaustive;
    }
  }
}

export async function listAuditLog(
  session: SessionClaims | null,
  options: ListAuditLogOptions = {},
): Promise<AuditLogPage> {
  const authorized = requireRole(session, {
    admin: ["super_admin", "admin"],
    mfa: true,
    clientAdminRole: options.clientAdminRole,
    clientMfaSatisfied: options.clientMfaSatisfied,
  });

  const take = options.take && options.take > 0 ? options.take : DEFAULT_TAKE;
  const cursorId = options.cursor ? BigInt(options.cursor) : null;

  return withRls(
    {
      userId: authorized.userId,
      programRole: authorized.programRole,
      adminRole: authorized.adminRole,
      status: authorized.status,
    },
    async (tx) => {
      const rows = await tx.auditLog.findMany({
        where: {
          ...windowWhere(authorized.adminRole),
          ...(cursorId ? { id: { lt: cursorId } } : {}),
        },
        orderBy: { id: "desc" },
        take: take + 1,
      });
      const hasMore = rows.length > take;
      const page = hasMore ? rows.slice(0, take) : rows;
      await writeAudit(tx, {
        actorUserId: authorized.userId,
        actorRole: authorized.adminRole,
        action: "audit_log_viewed",
        ip: options.ip ?? "127.0.0.1",
        userAgent: (options.userAgent ?? "unknown").slice(0, 512),
        severity: "info",
      });
      return {
        rows: page.map((row) => ({
          id: row.id.toString(),
          createdAt: row.createdAt.toISOString(),
          actorRole: row.actorRole,
          action: row.action,
          entityType: row.entityType,
          severity: row.severity,
        })),
        nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
      };
    },
  );
}
