import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { logoutSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { migrator } from "@/lib/db/migrator";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-sign-in-${randomUUID()}`;

async function latestAudit(action: string) {
  return migrator.auditLog.findFirst({
    where: { action, userAgent: USER_AGENT },
    orderBy: { createdAt: "desc" },
  });
}

describe("sign-in and logout (US1)", () => {
  afterEach(async () => {
    await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
  });

  it("signs in a seeded pathways member and writes login_success", async () => {
    const result = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });

    expect(result).not.toBeNull();
    expect(result?.programRole).toBe("pathways");
    expect(result?.status).toBe("active");

    const session = await migrator.session.findUnique({
      where: { id: result!.sessionId },
    });
    expect(session?.revokedAt).toBeNull();

    const audit = await latestAudit("login_success");
    expect(audit?.actorUserId).toBe(result!.userId);
    expect(audit?.severity).toBe("info");
  });

  it("returns the same generic failure for unknown, wrong password, denied, and deactivated", async () => {
    const password = env().SEED_PASSWORD;
    const attempts = [
      { email: "nobody@local", password },
      { email: "pathways@local", password: "wrong-password-12" },
      { email: "denied@local", password },
      { email: "deactivated@local", password },
    ];

    for (const attempt of attempts) {
      const result = await authorizeCredentials({
        ...attempt,
        ip: IP,
        userAgent: USER_AGENT,
      });
      expect(result).toBeNull();
    }

    const failures = await migrator.auditLog.findMany({
      where: { action: "login_failure", userAgent: USER_AGENT },
    });
    expect(failures).toHaveLength(attempts.length);
    for (const row of failures) {
      expect(row.severity).toBe("warning");
      const metadata = row.metadata;
      expect(JSON.stringify(metadata).toLowerCase()).not.toContain("email");
    }
  });

  it("logout revokes the session row and writes logout in the same flow", async () => {
    const signedIn = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(signedIn).not.toBeNull();

    await logoutSession({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
      ip: IP,
      userAgent: USER_AGENT,
    });

    const session = await migrator.session.findUnique({
      where: { id: signedIn!.sessionId },
    });
    expect(session?.revokedAt).not.toBeNull();

    const audit = await latestAudit("logout");
    expect(audit?.actorUserId).toBe(signedIn!.userId);
    expect(audit?.severity).toBe("info");
  });

  it("does not expose a distinct failure message on the public error constant", () => {
    expect(AUTH_FAILURE_MESSAGE).toBe("Unable to sign in.");
  });
});
