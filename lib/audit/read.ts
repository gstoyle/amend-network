import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { AUDIT_ACTIONS, type AuditAction, type AuditSeverity } from "@/lib/audit/actions";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_TAKE = 50;
const FILTER_ERROR = "Check the form and try again.";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class AuditFilterError extends Error {
  constructor() {
    super(FILTER_ERROR);
    this.name = "AuditFilterError";
  }
}

export type ListAuditLogOptions = {
  cursor?: string;
  take?: number;
  ip?: string;
  userAgent?: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  severity?: string;
};

export type AuditLogRow = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  targetUserId: string | null;
  ip: string;
  userAgent: string;
  severity: string;
};

export type AuditLogPage = {
  rows: AuditLogRow[];
  nextCursor: string | null;
};

export type AuditLogFilters = {
  actor?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
  severity?: AuditSeverity;
};

const filterSchema = z.object({
  actor: z.string().uuid().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  severity: z.enum(["info", "warning", "security"]).optional(),
});

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw.trim() === "") {
    return undefined;
  }
  return raw.trim();
}

function parseBound(raw: string, edge: "from" | "to"): Date {
  if (DATE_ONLY.test(raw)) {
    return edge === "from"
      ? new Date(`${raw}T00:00:00.000Z`)
      : new Date(`${raw}T23:59:59.999Z`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new AuditFilterError();
  }
  return parsed;
}

export function parseAuditLogFilters(input: {
  actor?: string | string[];
  action?: string | string[];
  from?: string | string[];
  to?: string | string[];
  severity?: string | string[];
}): AuditLogFilters {
  const parsed = filterSchema.safeParse({
    actor: firstQueryValue(input.actor),
    action: firstQueryValue(input.action),
    from: firstQueryValue(input.from),
    to: firstQueryValue(input.to),
    severity: firstQueryValue(input.severity),
  });
  if (!parsed.success) {
    throw new AuditFilterError();
  }
  const from = parsed.data.from ? parseBound(parsed.data.from, "from") : undefined;
  const to = parsed.data.to ? parseBound(parsed.data.to, "to") : undefined;
  if (from && to && from.getTime() > to.getTime()) {
    throw new AuditFilterError();
  }
  return {
    actor: parsed.data.actor,
    action: parsed.data.action,
    from,
    to,
    severity: parsed.data.severity,
  };
}

function createdAtFilter(
  adminRole: "super_admin" | "admin",
  from: Date | undefined,
  to: Date | undefined,
): Prisma.DateTimeFilter | undefined {
  switch (adminRole) {
    case "super_admin": {
      if (!from && !to) {
        return undefined;
      }
      return {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    case "admin": {
      const clip = new Date(Date.now() - NINETY_DAYS_MS);
      const gte = from && from.getTime() > clip.getTime() ? from : clip;
      return {
        gte,
        ...(to ? { lte: to } : {}),
      };
    }
    default: {
      const _exhaustive: never = adminRole;
      return _exhaustive;
    }
  }
}

export function listWhere(
  adminRole: SessionClaims["adminRole"],
  filters: AuditLogFilters,
  cursorId: bigint | null,
): Prisma.AuditLogWhereInput {
  switch (adminRole) {
    case "moderator":
    case "none":
      return { id: { in: [] } };
    case "super_admin":
    case "admin": {
      const createdAt = createdAtFilter(adminRole, filters.from, filters.to);
      return {
        AND: [
          createdAt ? { createdAt } : {},
          cursorId ? { id: { lt: cursorId } } : {},
          filters.actor ? { actorUserId: filters.actor } : {},
          filters.action ? { action: filters.action } : {},
          filters.severity ? { severity: filters.severity } : {},
        ],
      };
    }
    default: {
      const _exhaustive: never = adminRole;
      return _exhaustive;
    }
  }
}

export function toViewerRow(row: {
  id: bigint;
  createdAt: Date;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  targetUserId: string | null;
  ip: string;
  userAgent: string;
  severity: string;
}): AuditLogRow {
  return {
    id: row.id.toString(),
    createdAt: row.createdAt.toISOString(),
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    targetUserId: row.targetUserId,
    ip: row.ip,
    userAgent: row.userAgent,
    severity: row.severity,
  };
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

  const filters = parseAuditLogFilters({
    actor: options.actor,
    action: options.action,
    from: options.from,
    to: options.to,
    severity: options.severity,
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
        where: listWhere(authorized.adminRole, filters, cursorId),
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
        rows: page.map(toViewerRow),
        nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
      };
    },
  );
}
