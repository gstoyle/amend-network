import type { Prisma } from "@prisma/client";
import type { AuditAction, AuditSeverity } from "@/lib/audit/actions";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const PII_METADATA_KEYS = new Set([
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
  // INSERT without RETURNING: FORCE RLS SELECT on audit_log is admin-only,
  // and Prisma create() uses RETURNING which would fail for member logins.
  await tx.$executeRaw`
    INSERT INTO "audit_log" (
      "actor_user_id",
      "actor_role",
      "action",
      "entity_type",
      "entity_id",
      "target_user_id",
      "ip",
      "user_agent",
      "metadata",
      "severity"
    ) VALUES (
      ${event.actorUserId ?? null}::uuid,
      ${event.actorRole},
      ${event.action},
      ${event.entityType ?? null},
      ${event.entityId ?? null},
      ${event.targetUserId ?? null}::uuid,
      ${event.ip}::inet,
      ${event.userAgent},
      ${JSON.stringify(event.metadata ?? {})}::jsonb,
      ${event.severity}::"AuditSeverity"
    )
  `;
}
