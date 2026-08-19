import type { Prisma } from "@prisma/client";
import {
  defaultAnalyticsRetentionPort,
  type AnalyticsRetentionPort,
} from "@/lib/analytics/retention";
import { writeAudit } from "@/lib/audit/write";
import { withRls } from "@/lib/db/rls";
import { anonymizeEligibleUsers } from "@/lib/retention/anonymize";

export type RetentionJobOptions = {
  analyticsPort?: AnalyticsRetentionPort;
};

export type RetentionJobResult = {
  auditSecurityDeleted: number;
  auditOtherDeleted: number;
  analyticsDeleted: number;
  usersAnonymized: number;
  passwordResetTokensDeleted: number;
  invitationsDeleted: number;
};

const EMPTY_RESULT: RetentionJobResult = {
  auditSecurityDeleted: 0,
  auditOtherDeleted: 0,
  analyticsDeleted: 0,
  usersAnonymized: 0,
  passwordResetTokensDeleted: 0,
  invitationsDeleted: 0,
};

const JOB_IP = "127.0.0.1";
const JOB_USER_AGENT = "retention-job";

function utcYearsBefore(now: Date, years: number): Date {
  const value = new Date(now.getTime());
  value.setUTCFullYear(value.getUTCFullYear() - years);
  return value;
}

function utcMonthsBefore(now: Date, months: number): Date {
  const value = new Date(now.getTime());
  value.setUTCMonth(value.getUTCMonth() - months);
  return value;
}

async function writeClassTrail(
  tx: Prisma.TransactionClient,
  className:
    | "audit_security"
    | "audit_other"
    | "users_anonymized"
    | "analytics"
    | "password_reset_tokens"
    | "invitations",
  count: number,
): Promise<void> {
  if (count <= 0) {
    return;
  }
  await writeAudit(tx, {
    actorRole: "system",
    action: "retention_purged",
    ip: JOB_IP,
    userAgent: JOB_USER_AGENT,
    metadata: { class: className, count },
    severity: "info",
  });
}

export async function runRetentionJob(
  now: Date = new Date(),
  options: RetentionJobOptions = {},
): Promise<RetentionJobResult> {
  const analyticsPort = options.analyticsPort ?? defaultAnalyticsRetentionPort;
  return withRls(
    { adminRole: "admin", status: "active", authMode: "retention" },
    async (tx) => {
      const securityCutoff = utcYearsBefore(now, 7);
      const otherCutoff = utcYearsBefore(now, 3);

      const security = await tx.auditLog.deleteMany({
        where: { severity: "security", createdAt: { lt: securityCutoff } },
      });
      const other = await tx.auditLog.deleteMany({
        where: {
          severity: { in: ["info", "warning"] },
          createdAt: { lt: otherCutoff },
        },
      });

      await writeClassTrail(tx, "audit_security", security.count);
      await writeClassTrail(tx, "audit_other", other.count);

      const analyticsDeleted = await analyticsPort.deleteOlderThan(utcMonthsBefore(now, 24));
      await writeClassTrail(tx, "analytics", analyticsDeleted);

      const usersAnonymized = await anonymizeEligibleUsers(tx, now);
      await writeClassTrail(tx, "users_anonymized", usersAnonymized);

      const passwordResetTokens = await tx.passwordResetToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
        },
      });
      await writeClassTrail(tx, "password_reset_tokens", passwordResetTokens.count);

      const invitations = await tx.invitation.deleteMany({
        where: { status: { in: ["expired", "revoked"] } },
      });
      await writeClassTrail(tx, "invitations", invitations.count);

      return {
        ...EMPTY_RESULT,
        auditSecurityDeleted: security.count,
        auditOtherDeleted: other.count,
        analyticsDeleted,
        usersAnonymized,
        passwordResetTokensDeleted: passwordResetTokens.count,
        invitationsDeleted: invitations.count,
      };
    },
  );
}
