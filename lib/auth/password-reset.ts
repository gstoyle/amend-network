import { writeAudit } from "@/lib/audit/write";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import { sendResetEmail } from "@/lib/email/transport";
import { decryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { hashToken, randomToken } from "@/lib/crypto/token";
import { bindRlsRoleSnapshot, withRls } from "@/lib/db/rls";
import { env } from "@/lib/env";

const TOKEN_TTL_MS = 60 * 60 * 1000;

export type ResetRequestResult = { ok: true; token?: string };
export type ResetCompleteResult = { ok: true } | { ok: false; error: string };

function actorRole(user: { adminRole: string; programRole: string }): string {
  return user.adminRole !== "none" ? user.adminRole : user.programRole;
}

export async function requestPasswordReset(input: {
  email: string;
  ip: string;
  userAgent: string;
}): Promise<ResetRequestResult> {
  const userAgent = input.userAgent.slice(0, 512);
  const user = await withRls({ authMode: "credential_lookup" }, async (tx) =>
    tx.user.findUnique({ where: { emailLookup: hmacEmailLookup(input.email) } }),
  );

  if (!user) {
    await withRls({}, async (tx) => {
      await writeAudit(tx, {
        actorRole: "anonymous",
        action: "password_reset_requested",
        ip: input.ip,
        userAgent,
        metadata: { unknown: true },
        severity: "info",
      });
    });
    return { ok: true };
  }

  const token = randomToken();
  await withRls({ userId: user.id }, async (tx) => {
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    await writeAudit(tx, {
      actorUserId: user.id,
      actorRole: actorRole(user),
      action: "password_reset_requested",
      ip: input.ip,
      userAgent,
      severity: "info",
    });
  });

  const baseUrl = env().AUTH_URL ?? "http://127.0.0.1:3000";
  await sendResetEmail({
    to: decryptPii(user.emailEncrypted),
    resetUrl: `${baseUrl}/reset-password?token=${token}`,
  });
  return { ok: true, token };
}

export async function completePasswordReset(input: {
  token: string;
  password: string;
  ip: string;
  userAgent: string;
}): Promise<ResetCompleteResult> {
  const userAgent = input.userAgent.slice(0, 512);
  const tokenHash = hashToken(input.token);

  const existing = await withRls({ authMode: "password_reset" }, async (tx) =>
    tx.passwordResetToken.findUnique({ where: { tokenHash } }),
  );
  if (!existing || existing.consumedAt || existing.expiresAt <= new Date()) {
    return { ok: false, error: AUTH_FAILURE_MESSAGE };
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(input.password);
  } catch {
    return { ok: false, error: AUTH_FAILURE_MESSAGE };
  }
  await withRls({ userId: existing.userId }, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: existing.userId } });
    if (!user) {
      return;
    }
    await bindRlsRoleSnapshot(tx, user);
    await tx.user.update({
      where: { id: existing.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.updateMany({
      where: { id: existing.id, userId: existing.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.session.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(tx, {
      actorUserId: existing.userId,
      actorRole: actorRole(user),
      action: "password_reset_completed",
      ip: input.ip,
      userAgent,
      severity: "security",
    });
  });
  return { ok: true };
}
