import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSession,
  revokeAllSessions,
} from "@/lib/auth/session";
import { hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";

const USER_AGENT = `vitest-guc-scope-${randomUUID()}`;
const TOKEN_HASH = new Uint8Array(randomBytes(32));
const THROTTLE_HASH = new Uint8Array(randomBytes(32));

async function seedUser() {
  const user = await migrator.user.findUnique({
    where: { emailLookup: hmacEmailLookup("pathways@local") },
  });
  if (!user) {
    throw new Error("seed user pathways@local is required");
  }
  return user;
}

describe("auth-mode GUC scope (Foundational/US1 amendment)", () => {
  afterEach(async () => {
    await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
    await migrator.passwordResetToken.deleteMany({
      where: { tokenHash: TOKEN_HASH },
    });
    await migrator.authThrottle.deleteMany({
      where: { identifierHash: THROTTLE_HASH },
    });
  });

  it("session_lookup can read a session by id but not reset tokens or throttle", async () => {
    const user = await seedUser();
    const session = await migrator.session.create({
      data: {
        userId: user.id,
        tokenHash: new Uint8Array(randomBytes(32)),
        userAgent: USER_AGENT,
        ip: "127.0.0.1",
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await migrator.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: TOKEN_HASH,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await migrator.authThrottle.create({
      data: {
        identifierHash: THROTTLE_HASH,
        failedCount: 1,
        windowStartedAt: new Date(),
      },
    });

    const seen = await withRls({ authMode: "session_lookup" }, async (tx) => ({
      session: await tx.session.findUnique({ where: { id: session.id } }),
      resetTokens: await tx.passwordResetToken.findMany(),
      throttles: await tx.authThrottle.findMany(),
      users: await tx.user.findMany(),
    }));

    expect(seen.session).not.toBeNull();
    expect(seen.session?.id).toBe(session.id);
    expect(seen.resetTokens).toHaveLength(0);
    expect(seen.throttles).toHaveLength(0);
    expect(seen.users).toHaveLength(0);
  });

  it("createSession and revokeAllSessions succeed using only userId scope", async () => {
    const user = await seedUser();
    const created = await createSession({
      userId: user.id,
      ip: "127.0.0.1",
      userAgent: USER_AGENT,
      programRole: user.programRole,
      adminRole: user.adminRole,
      status: user.status,
    });
    expect(created.sessionId).toBeTruthy();

    const row = await migrator.session.findUnique({
      where: { id: created.sessionId },
    });
    expect(row?.revokedAt).toBeNull();
    expect(row?.userId).toBe(user.id);

    await revokeAllSessions(user.id);

    const revoked = await migrator.session.findUnique({
      where: { id: created.sessionId },
    });
    expect(revoked?.revokedAt).not.toBeNull();
  });
});
