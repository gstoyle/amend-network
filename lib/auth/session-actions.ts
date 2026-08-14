import { writeAudit } from "@/lib/audit/write";
import { withRls } from "@/lib/db/rls";

export type OwnSession = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string;
  userAgent: string;
};

export async function listOwnSessions(userId: string): Promise<OwnSession[]> {
  return withRls({ userId }, async (tx) => {
    const rows = await tx.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      ip: row.ip,
      userAgent: row.userAgent,
    }));
  });
}

export async function revokeOwnSession(input: {
  sessionId: string;
  userId: string;
  ip: string;
  userAgent: string;
}): Promise<void> {
  const userAgent = input.userAgent.slice(0, 512);
  await withRls({ userId: input.userId }, async (tx) => {
    const updated = await tx.session.updateMany({
      where: { id: input.sessionId, userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) {
      return;
    }
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    await writeAudit(tx, {
      actorUserId: input.userId,
      actorRole: user
        ? user.adminRole !== "none"
          ? user.adminRole
          : user.programRole
        : "none",
      action: "session_revoked",
      entityType: "session",
      entityId: input.sessionId,
      ip: input.ip,
      userAgent,
      severity: "info",
    });
  });
}
