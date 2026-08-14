import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { adminMfaDestination } from "@/lib/auth/admin-mfa";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { authorizeCredentials } from "@/lib/auth/credentials";
import {
  beginMfaEnrollment,
  completeMfaChallenge,
  completeMfaEnrollment,
} from "@/lib/auth/mfa";
import { requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { generateTotp, verifyTotp } from "@/lib/auth/totp";
import { hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-mfa-${randomUUID()}`;

async function seedUser(email: string) {
  const user = await migrator.user.findUnique({
    where: { emailLookup: hmacEmailLookup(email) },
  });
  if (!user) {
    throw new Error(`missing seed user ${email}`);
  }
  return user;
}

async function latestAudit(action: string) {
  return migrator.auditLog.findFirst({
    where: { action, userAgent: USER_AGENT },
    orderBy: { createdAt: "desc" },
  });
}

async function resetAdminMfa(): Promise<void> {
  const admin = await seedUser("admin@local");
  await migrator.user.update({
    where: { id: admin.id },
    data: { mfaEnabled: false, mfaSecretEncrypted: null },
  });
  await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
}

describe("TOTP enrollment and challenge (US3 / FR-012)", () => {
  afterEach(async () => {
    await resetAdminMfa();
  });

  it("generates a 6-digit SHA1 TOTP that verifies for the current window", () => {
    const secret = generateTotp({ label: "admin-test" });
    expect(secret.otpauthUri.startsWith("otpauth://totp/")).toBe(true);
    expect(verifyTotp(secret.secret, secret.generate())).toBe(true);
    expect(verifyTotp(secret.secret, "000000")).toBe(false);
  });

  it("enrolls admin@local with a valid code and sets mfa_enabled plus mfa_satisfied", async () => {
    const signedIn = await authorizeCredentials({
      email: "admin@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(signedIn).not.toBeNull();
    expect(signedIn!.mfaEnabled).toBe(false);

    const pending = await beginMfaEnrollment({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
    });
    expect(pending.otpauthUri.startsWith("otpauth://totp/")).toBe(true);

    const result = await completeMfaEnrollment({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
      code: generateTotp({ secret: pending.secret, label: "admin-test" }).generate(),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(result.ok).toBe(true);

    const claims = await loadSession(signedIn!.sessionId);
    expect(claims?.mfaEnabled).toBe(true);
    expect(claims?.mfaSatisfied).toBe(true);

    const audit = await latestAudit("mfa_enrolled");
    expect(audit?.actorUserId).toBe(signedIn!.userId);
    expect(audit?.severity).toBe("info");
  });

  it("denies a wrong enroll code and writes mfa_challenge_failed", async () => {
    const signedIn = await authorizeCredentials({
      email: "admin@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    await beginMfaEnrollment({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
    });

    const result = await completeMfaEnrollment({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
      code: "000000",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(AUTH_FAILURE_MESSAGE);
    }

    const claims = await loadSession(signedIn!.sessionId);
    expect(claims?.mfaEnabled).toBe(false);
    expect(claims?.mfaSatisfied).toBe(false);

    const audit = await latestAudit("mfa_challenge_failed");
    expect(audit?.actorUserId).toBe(signedIn!.userId);
    expect(audit?.severity).toBe("security");
  });

  it("challenges an enrolled admin and writes mfa_challenge_failed on a wrong code", async () => {
    const signedIn = await authorizeCredentials({
      email: "admin@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    const pending = await beginMfaEnrollment({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
    });
    const enroll = await completeMfaEnrollment({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
      code: generateTotp({ secret: pending.secret, label: "admin-test" }).generate(),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(enroll.ok).toBe(true);

    await migrator.session.update({
      where: { id: signedIn!.sessionId },
      data: { mfaSatisfied: false },
    });

    const failed = await completeMfaChallenge({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
      code: "000000",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(failed.ok).toBe(false);

    const failAudit = await latestAudit("mfa_challenge_failed");
    expect(failAudit?.actorUserId).toBe(signedIn!.userId);

    const passed = await completeMfaChallenge({
      sessionId: signedIn!.sessionId,
      userId: signedIn!.userId,
      code: generateTotp({ secret: pending.secret, label: "admin-test" }).generate(),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(passed.ok).toBe(true);
    const claims = await loadSession(signedIn!.sessionId);
    expect(claims?.mfaSatisfied).toBe(true);
  });

  it("does not enroll a Pathways member", async () => {
    const signedIn = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    await expect(
      beginMfaEnrollment({
        sessionId: signedIn!.sessionId,
        userId: signedIn!.userId,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("Independent Test: admin@local blocked until enroll; wrong code audited; Pathways not prompted", async () => {
    const admin = await authorizeCredentials({
      email: "admin@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(admin).not.toBeNull();
    const adminClaims = await loadSession(admin!.sessionId);
    expect(adminClaims?.mfaEnabled).toBe(false);
    expect(adminClaims?.mfaSatisfied).toBe(false);
    expect(adminMfaDestination(adminClaims)).toBe("/mfa/enroll");
    expect(() =>
      requireRole(adminClaims, {
        admin: ["super_admin", "admin", "moderator"],
        mfa: true,
      }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);

    const pending = await beginMfaEnrollment({
      sessionId: admin!.sessionId,
      userId: admin!.userId,
    });
    const wrong = await completeMfaEnrollment({
      sessionId: admin!.sessionId,
      userId: admin!.userId,
      code: "000000",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(wrong.ok).toBe(false);
    const failedAudit = await latestAudit("mfa_challenge_failed");
    expect(failedAudit?.actorUserId).toBe(admin!.userId);

    const enrolled = await completeMfaEnrollment({
      sessionId: admin!.sessionId,
      userId: admin!.userId,
      code: generateTotp({ secret: pending.secret, label: "admin-test" }).generate(),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(enrolled.ok).toBe(true);
    const satisfied = await loadSession(admin!.sessionId);
    expect(satisfied?.mfaEnabled).toBe(true);
    expect(satisfied?.mfaSatisfied).toBe(true);
    expect(adminMfaDestination(satisfied)).toBeNull();
    expect(
      requireRole(satisfied, {
        admin: ["super_admin", "admin", "moderator"],
        mfa: true,
      }).adminRole,
    ).toBe("admin");

    const pathways = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    const pathwaysClaims = await loadSession(pathways!.sessionId);
    expect(adminMfaDestination(pathwaysClaims)).toBeNull();
    expect(requireRole(pathwaysClaims).programRole).toBe("pathways");
  });
});
