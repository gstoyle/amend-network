import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { authorizeCredentials } from "@/lib/auth/credentials";
import {
  completePasswordReset,
  requestPasswordReset,
} from "@/lib/auth/password-reset";
import { loadSession } from "@/lib/auth/session";
import { hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-reset-${randomUUID()}`;

describe("password reset (US6 / FR-014)", () => {
  afterEach(async () => {
    await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    const user = await migrator.user.findUnique({
      where: { emailLookup: hmacEmailLookup("pathways@local") },
    });
    if (user) {
      await migrator.passwordResetToken.deleteMany({ where: { userId: user.id } });
    }
  });

  it("Independent Test: known reset kills sessions; unknown is success + distinct audit; expired fails", async () => {
    const signedIn = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(signedIn).not.toBeNull();

    const known = await requestPasswordReset({
      email: "pathways@local",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(known.ok).toBe(true);
    expect(known.token).toBeTruthy();

    const unknown = await requestPasswordReset({
      email: `nobody-${randomUUID()}@local`,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(unknown.ok).toBe(true);
    expect(unknown.token).toBeUndefined();
    const unknownAudit = await migrator.auditLog.findFirst({
      where: { action: "password_reset_requested", userAgent: USER_AGENT },
      orderBy: { createdAt: "desc" },
    });
    expect(unknownAudit?.metadata).toMatchObject({ unknown: true });

    const completed = await completePasswordReset({
      token: known.token!,
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(completed.ok).toBe(true);
    expect(await loadSession(signedIn!.sessionId)).toBeNull();

    const reused = await completePasswordReset({
      token: known.token!,
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(reused.ok).toBe(false);
    if (!reused.ok) {
      expect(reused.error).toBe(AUTH_FAILURE_MESSAGE);
    }

    const expired = await completePasswordReset({
      token: "expired-or-missing-token-value",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(expired.ok).toBe(false);
  });
});
