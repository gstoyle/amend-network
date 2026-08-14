import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { listOwnSessions, revokeOwnSession } from "@/lib/auth/session-actions";
import { loadSession } from "@/lib/auth/session";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";

const IP = "127.0.0.1";
const USER_AGENT_A = `vitest-sessions-a-${randomUUID()}`;
const USER_AGENT_B = `vitest-sessions-b-${randomUUID()}`;

describe("concurrent sessions and revoke (US7 / FR-005)", () => {
  afterEach(async () => {
    await migrator.session.deleteMany({
      where: { userAgent: { in: [USER_AGENT_A, USER_AGENT_B] } },
    });
    await migrator.auditLog.deleteMany({
      where: { userAgent: { in: [USER_AGENT_A, USER_AGENT_B] } },
    });
  });

  it("Independent Test: revoke one of two sessions; the other stays valid", async () => {
    const first = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT_A,
    });
    const second = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT_B,
    });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    const listed = await listOwnSessions(first!.userId);
    const ids = listed.map((row) => row.id);
    expect(ids).toContain(first!.sessionId);
    expect(ids).toContain(second!.sessionId);

    await revokeOwnSession({
      sessionId: first!.sessionId,
      userId: first!.userId,
      ip: IP,
      userAgent: USER_AGENT_A,
    });

    expect(await loadSession(first!.sessionId)).toBeNull();
    expect(await loadSession(second!.sessionId)).not.toBeNull();

    const audit = await migrator.auditLog.findFirst({
      where: { action: "session_revoked", userAgent: USER_AGENT_A },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.entityId).toBe(first!.sessionId);
  });
});
