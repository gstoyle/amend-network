import { randomBytes, createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit/write";
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

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

/** Auth.js always stamps Expires from session.maxAge; strip it so the cookie dies on browser close. */
export function asBrowserCloseSetCookie(header: string): string {
  const name = sessionCookieName().toLowerCase();
  const lower = header.toLowerCase();
  if (!lower.startsWith(`${name}=`) && !lower.startsWith(`${name}.`)) {
    return header;
  }
  return header.replace(/;\s*Max-Age=\d+/gi, "").replace(/;\s*Expires=[^;]*/gi, "");
}

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

export async function insertSession(
  tx: Prisma.TransactionClient,
  input: CreateSessionInput,
): Promise<{ sessionId: string; token: string; claims: SessionClaims }> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const exp = expiresAt(now, now);

  const row = await tx.session.create({
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
  });

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

export async function createSession(
  input: CreateSessionInput,
): Promise<{ sessionId: string; token: string; claims: SessionClaims }> {
  return withRls({ userId: input.userId }, (tx) => insertSession(tx, input));
}

export async function loadSession(sessionId: string): Promise<SessionClaims | null> {
  const now = new Date();
  const sessionRow = await withRls({ authMode: "session_lookup" }, async (tx) =>
    tx.session.findUnique({ where: { id: sessionId } }),
  );
  if (!sessionRow || sessionRow.revokedAt || sessionRow.expiresAt <= now) {
    return null;
  }

  return withRls({ userId: sessionRow.userId }, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: sessionRow.userId } });
    if (!user) {
      return null;
    }
    const exp = expiresAt(sessionRow.createdAt, now);
    await tx.session.updateMany({
      where: { id: sessionRow.id, userId: sessionRow.userId, revokedAt: null },
      data: { lastSeenAt: now, expiresAt: exp },
    });
    return {
      sessionId: sessionRow.id,
      userId: sessionRow.userId,
      programRole: user.programRole,
      adminRole: user.adminRole,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      mfaSatisfied: sessionRow.mfaSatisfied,
      expiresAt: exp.toISOString(),
    };
  });
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
  await withRls({ userId }, async (tx) => {
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function logoutSession(input: {
  sessionId: string;
  userId: string;
  ip: string;
  userAgent: string;
}): Promise<void> {
  const userAgent = input.userAgent.slice(0, 512);
  await withRls({ userId: input.userId }, async (tx) => {
    await tx.session.updateMany({
      where: { id: input.sessionId, userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    await writeAudit(tx, {
      actorUserId: input.userId,
      actorRole: user
        ? user.adminRole !== "none"
          ? user.adminRole
          : user.programRole
        : "none",
      action: "logout",
      entityType: "session",
      entityId: input.sessionId,
      ip: input.ip,
      userAgent,
      severity: "info",
    });
  });
}
