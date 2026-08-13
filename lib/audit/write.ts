import type { Prisma } from "@prisma/client";
import type { AuditAction, AuditSeverity } from "@/lib/audit/actions";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

const PII_METADATA_KEYS = new Set([
  "email",
  "name",
  "first_name",
  "last_name",
  "password",
  "token",
  "secret",
  "mfa",
  "doc",
  "doc_affiliation",
]);

export type AuditEvent = {
  actorUserId?: string | null;
  actorRole: string;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  targetUserId?: string | null;
  ip: string;
  userAgent: string;
  metadata?: Prisma.InputJsonValue;
  severity: AuditSeverity;
};

function assertNoPiiMetadata(metadata: Prisma.InputJsonValue | undefined): void {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return;
  }
  for (const key of Object.keys(metadata)) {
    if (PII_METADATA_KEYS.has(key.toLowerCase())) {
      throw new Error("audit metadata must not contain PII fields");
    }
  }
}

export async function writeAudit(
  tx: Prisma.TransactionClient,
  event: AuditEvent,
): Promise<void> {
  if (!AUDIT_ACTIONS.includes(event.action)) {
    throw new Error("unknown audit action");
  }
  assertNoPiiMetadata(event.metadata);
  await tx.auditLog.create({
    data: {
      actorUserId: event.actorUserId ?? null,
      actorRole: event.actorRole,
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      targetUserId: event.targetUserId ?? null,
      ip: event.ip,
      userAgent: event.userAgent,
      metadata: event.metadata ?? {},
      severity: event.severity,
    },
  });
}
