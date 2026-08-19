import { writeAudit } from "@/lib/audit/write";
import {
  listWhere,
  parseAuditLogFilters,
  toViewerRow,
  type AuditLogRow,
  type ListAuditLogOptions,
} from "@/lib/audit/read";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { env } from "@/lib/env";

export const AUDIT_CSV_HEADERS = [
  "id",
  "created_at",
  "actor_user_id",
  "actor_role",
  "action",
  "entity_type",
  "entity_id",
  "target_user_id",
  "ip",
  "user_agent",
  "severity",
] as const;

export const EXPORT_METADATA_KEYS = [
  "rowCount",
  "hasActor",
  "hasAction",
  "hasFrom",
  "hasTo",
  "hasSeverity",
] as const;

export type ExportAuditLogOptions = Omit<ListAuditLogOptions, "cursor" | "take">;

export type ExportAuditLogResult = {
  csv: string;
  rowCount: number;
};

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function rfc4180Field(raw: string): string {
  let value = raw;
  if (FORMULA_PREFIX.test(value)) {
    value = `'${value}`;
  }
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function csvCell(row: AuditLogRow, header: (typeof AUDIT_CSV_HEADERS)[number]): string {
  switch (header) {
    case "id":
      return row.id;
    case "created_at":
      return row.createdAt;
    case "actor_user_id":
      return row.actorUserId ?? "";
    case "actor_role":
      return row.actorRole;
    case "action":
      return row.action;
    case "entity_type":
      return row.entityType ?? "";
    case "entity_id":
      return row.entityId ?? "";
    case "target_user_id":
      return row.targetUserId ?? "";
    case "ip":
      return row.ip;
    case "user_agent":
      return row.userAgent;
    case "severity":
      return row.severity;
    default: {
      const _exhaustive: never = header;
      return _exhaustive;
    }
  }
}

function toCsv(rows: AuditLogRow[]): string {
  const lines = [
    AUDIT_CSV_HEADERS.join(","),
    ...rows.map((row) =>
      AUDIT_CSV_HEADERS.map((header) => rfc4180Field(csvCell(row, header))).join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function assertExportCsrf(request: Request): void {
  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set([requestOrigin]);
  const authUrl = env().AUTH_URL;
  if (authUrl) {
    try {
      allowed.add(new URL(authUrl).origin);
    } catch {
      // AUTH_URL is optional; ignore unparseable values and keep request origin.
    }
  }
  const origin = request.headers.get("origin");
  if (origin) {
    if (!allowed.has(origin)) {
      throw new AuthDeniedError();
    }
    return;
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (allowed.has(new URL(referer).origin)) {
        return;
      }
    } catch {
      throw new AuthDeniedError();
    }
  }
  throw new AuthDeniedError();
}

export async function exportAuditLog(
  session: SessionClaims | null,
  options: ExportAuditLogOptions = {},
): Promise<ExportAuditLogResult> {
  const authorized = requireRole(session, {
    admin: ["super_admin"],
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

  return withRls(
    {
      userId: authorized.userId,
      programRole: authorized.programRole,
      adminRole: authorized.adminRole,
      status: authorized.status,
    },
    async (tx) => {
      const rows = await tx.auditLog.findMany({
        where: listWhere(authorized.adminRole, filters, null),
        orderBy: { id: "desc" },
      });
      const csv = toCsv(rows.map(toViewerRow));
      await writeAudit(tx, {
        actorUserId: authorized.userId,
        actorRole: authorized.adminRole,
        action: "audit_log_exported",
        ip: options.ip ?? "127.0.0.1",
        userAgent: (options.userAgent ?? "unknown").slice(0, 512),
        severity: "info",
        metadata: {
          rowCount: rows.length,
          hasActor: Boolean(filters.actor),
          hasAction: Boolean(filters.action),
          hasFrom: Boolean(filters.from),
          hasTo: Boolean(filters.to),
          hasSeverity: Boolean(filters.severity),
        },
      });
      return { csv, rowCount: rows.length };
    },
  );
}
