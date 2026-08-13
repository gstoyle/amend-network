import { randomBytes, createHash } from "node:crypto";
import type { SessionClaims } from "@/lib/auth/types";
import type { AdminRole, ProgramRole, UserStatus } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";

const SLIDING_MS = 24 * 60 * 60 * 1000;
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

function hashToken(token: string): Uint8Array<ArrayBuffer> {
  const digest = createHash("sha256").update(token).digest();
  const copy = new Uint8Array(digest.byteLength);
  copy.set(digest);
  return copy;
}

function expiresAt(createdAt: Date, lastSeenAt: Date): Date {
  const sliding = new Date(lastSeenAt.getTime() + SLIDING_MS);
  const absolute = new Date(createdAt.getTime() + ABSOLUTE_MS);
  return sliding < absolute ? sliding : absolute;
}

export type CreateSessionInput = {
  userId: string;
  ip: string;
  userAgent: string;
  mfaSatisfied?: boolean;
  programRole: ProgramRole;
  adminRole: AdminRole;
  status: UserStatus;
};

export async function createSession(
  input: CreateSessionInput,
): Promise<{ sessionId: string; token: string; claims: SessionClaims }> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const exp = expiresAt(now, now);

  const row = await withRls(
    {
      userId: input.userId,
      programRole: input.programRole,
      adminRole: input.adminRole,
      status: input.status,
      authMode: "credential_check",
    },
    async (tx) =>
      tx.session.create({
        data: {
          userId: input.userId,
          tokenHash: hashToken(token),
          userAgent: input.userAgent,
          ip: input.ip,
          createdAt: now,
          lastSeenAt: now,
          expiresAt: exp,
          mfaSatisfied: input.mfaSatisfied ?? false,
        },
      }),
  );

  const claims: SessionClaims = {
    sessionId: row.id,
    userId: input.userId,
    programRole: input.programRole,
    adminRole: input.adminRole,
    status: input.status,
    mfaEnabled: false,
    mfaSatisfied: row.mfaSatisfied,
    expiresAt: exp.toISOString(),
  };

  return { sessionId: row.id, token, claims };
}

export async function loadSession(sessionId: string): Promise<SessionClaims | null> {
  const now = new Date();
  const loaded = await withRls({ authMode: "credential_check" }, async (tx) => {
    const row = await tx.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!row || row.revokedAt || row.expiresAt <= now) {
      return null;
    }
    const exp = expiresAt(row.createdAt, now);
    await tx.session.update({
      where: { id: row.id },
      data: { lastSeenAt: now, expiresAt: exp },
    });
    return { row, exp };
  });

  if (!loaded) {
    return null;
  }

  return {
    sessionId: loaded.row.id,
    userId: loaded.row.userId,
    programRole: loaded.row.user.programRole,
    adminRole: loaded.row.user.adminRole,
    status: loaded.row.user.status,
    mfaEnabled: loaded.row.user.mfaEnabled,
    mfaSatisfied: loaded.row.mfaSatisfied,
    expiresAt: loaded.exp.toISOString(),
  };
}

export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await withRls({ userId }, async (tx) => {
    await tx.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await withRls({ userId, authMode: "credential_check" }, async (tx) => {
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}
