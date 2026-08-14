import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-lockout-${randomUUID()}`;

async function latestSecurity() {
  return migrator.auditLog.findFirst({
    where: { action: "login_failure", userAgent: USER_AGENT, severity: "security" },
    orderBy: { createdAt: "desc" },
  });
}

describe("lockout without enumeration (US5 / FR-013)", () => {
  const throwawayEmail = `lockout-${randomUUID()}@local`;

  afterEach(async () => {
    const lookup = hmacEmailLookup(throwawayEmail);
    const user = await migrator.user.findUnique({ where: { emailLookup: lookup } });
    if (user) {
      await migrator.session.deleteMany({ where: { userId: user.id } });
      await migrator.user.delete({ where: { id: user.id } });
    }
    await migrator.authThrottle.deleteMany({ where: { identifierHash: lookup } });
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
  });

  it("Independent Test: 11th attempt refused with generic copy and a security audit row", async () => {
    const password = env().SEED_PASSWORD;
    await migrator.user.create({
      data: {
        id: randomUUID(),
        emailLookup: hmacEmailLookup(throwawayEmail),
        emailEncrypted: encryptPii(throwawayEmail),
        passwordHash: await hashPassword(password),
        firstNameEncrypted: encryptPii("Lock"),
        lastNameEncrypted: encryptPii("Out"),
        programRole: "pathways",
        adminRole: "none",
        status: "active",
      },
    });

    for (let i = 0; i < 10; i += 1) {
      const failed = await authorizeCredentials({
        email: throwawayEmail,
        password: "wrong-password-12",
        ip: IP,
        userAgent: USER_AGENT,
      });
      expect(failed).toBeNull();
    }

    const eleventh = await authorizeCredentials({
      email: throwawayEmail,
      password,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(eleventh).toBeNull();

    const unknown = await authorizeCredentials({
      email: `nobody-${randomUUID()}@local`,
      password: "wrong-password-12",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(unknown).toBeNull();

    expect(AUTH_FAILURE_MESSAGE).toBe("Unable to sign in.");
    const security = await latestSecurity();
    expect(security).not.toBeNull();
    expect(security?.severity).toBe("security");
  });
});
