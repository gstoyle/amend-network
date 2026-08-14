import { writeAudit } from "@/lib/audit/write";
import { ADMIN_ROLES } from "@/lib/auth/admin-mfa";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { generateTotp, verifyTotp } from "@/lib/auth/totp";
import { decryptPii, encryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";

export type MfaResult = { ok: true } | { ok: false; error: string };

type MfaSessionInput = {
  sessionId: string;
  userId: string;
};

type MfaCodeInput = MfaSessionInput & {
  code: string;
  ip: string;
  userAgent: string;
};

function actorRole(adminRole: string, programRole: string): string {
  return adminRole !== "none" ? adminRole : programRole;
}

async function requireAdminSession(input: MfaSessionInput) {
  const claims = await loadSession(input.sessionId);
  requireRole(claims, { admin: [...ADMIN_ROLES] });
  if (!claims || claims.userId !== input.userId) {
    throw new AuthDeniedError();
  }
  return claims;
}

export async function beginMfaEnrollment(input: MfaSessionInput): Promise<{
  secret: string;
  otpauthUri: string;
}> {
  const claims = await requireAdminSession(input);
  if (claims.mfaEnabled) {
    throw new AuthDeniedError();
  }

  const totp = generateTotp({ label: input.userId });
  await withRls({ userId: input.userId }, async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        mfaSecretEncrypted: encryptPii(totp.secret),
        mfaEnabled: false,
      },
    });
  });

  return { secret: totp.secret, otpauthUri: totp.otpauthUri };
}

export async function completeMfaEnrollment(input: MfaCodeInput): Promise<MfaResult> {
  try {
    await requireAdminSession(input);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return { ok: false, error: AUTH_FAILURE_MESSAGE };
    }
    throw error;
  }

  const userAgent = input.userAgent.slice(0, 512);
  return withRls({ userId: input.userId }, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user?.mfaSecretEncrypted || user.mfaEnabled || user.adminRole === "none") {
      return { ok: false, error: AUTH_FAILURE_MESSAGE };
    }

    const secret = decryptPii(user.mfaSecretEncrypted);
    if (!verifyTotp(secret, input.code)) {
      await writeAudit(tx, {
        actorUserId: input.userId,
        actorRole: actorRole(user.adminRole, user.programRole),
        action: "mfa_challenge_failed",
        entityType: "session",
        entityId: input.sessionId,
        ip: input.ip,
        userAgent,
        severity: "security",
      });
      return { ok: false, error: AUTH_FAILURE_MESSAGE };
    }

    await tx.user.update({
      where: { id: input.userId },
      data: { mfaEnabled: true },
    });
    await tx.session.updateMany({
      where: { id: input.sessionId, userId: input.userId, revokedAt: null },
      data: { mfaSatisfied: true },
    });
    await writeAudit(tx, {
      actorUserId: input.userId,
      actorRole: actorRole(user.adminRole, user.programRole),
      action: "mfa_enrolled",
      entityType: "session",
      entityId: input.sessionId,
      ip: input.ip,
      userAgent,
      severity: "info",
    });
    return { ok: true };
  });
}

export async function completeMfaChallenge(input: MfaCodeInput): Promise<MfaResult> {
  try {
    await requireAdminSession(input);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return { ok: false, error: AUTH_FAILURE_MESSAGE };
    }
    throw error;
  }

  const userAgent = input.userAgent.slice(0, 512);
  return withRls({ userId: input.userId }, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user?.mfaSecretEncrypted || !user.mfaEnabled || user.adminRole === "none") {
      return { ok: false, error: AUTH_FAILURE_MESSAGE };
    }

    const secret = decryptPii(user.mfaSecretEncrypted);
    if (!verifyTotp(secret, input.code)) {
      await writeAudit(tx, {
        actorUserId: input.userId,
        actorRole: actorRole(user.adminRole, user.programRole),
        action: "mfa_challenge_failed",
        entityType: "session",
        entityId: input.sessionId,
        ip: input.ip,
        userAgent,
        severity: "security",
      });
      return { ok: false, error: AUTH_FAILURE_MESSAGE };
    }

    await tx.session.updateMany({
      where: { id: input.sessionId, userId: input.userId, revokedAt: null },
      data: { mfaSatisfied: true },
    });
    return { ok: true };
  });
}
