import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import type { SessionClaims } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { loadShellIdentity } from "@/lib/profile/identity";

const MARKER = `shell-identity-${randomUUID()}`;

function sessionFor(
  userId: string,
  programRole: "pathways" | "lead" | "none",
): SessionClaims {
  return {
    sessionId: `${MARKER}-${userId}`,
    userId,
    programRole,
    adminRole: "none",
    status: "active",
    mfaEnabled: false,
    mfaSatisfied: false,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function insertUser(input: {
  firstName: string | null;
  lastName: string | null;
  programRole: "pathways" | "lead" | "none";
}): Promise<string> {
  const id = randomUUID();
  const email = `${MARKER}-${id}@example.com`;
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(email),
      emailEncrypted: encryptPii(email),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: input.firstName ? encryptPii(input.firstName) : null,
      lastNameEncrypted: input.lastName ? encryptPii(input.lastName) : null,
      programRole: input.programRole,
      adminRole: "none",
      status: "active",
    },
  });
  return id;
}

describe("shell identity degradation (012 T027)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    createdUserIds.length = 0;
  });

  it("gives a named member a first name and a program badge label", async () => {
    const id = await insertUser({
      firstName: "Dana",
      lastName: "Whitfield",
      programRole: "lead",
    });
    createdUserIds.push(id);

    const identity = await loadShellIdentity(sessionFor(id, "lead"));
    expect(identity.firstName).toBe("Dana");
    expect(identity.displayName).toBe("Dana Whitfield");
    expect(identity.initials).toBe("DW");
    expect(identity.programRoleLabel).toBe("LEAD");
  });

  it("returns a null first name for a retention-anonymised account", async () => {
    const id = await insertUser({ firstName: null, lastName: null, programRole: "pathways" });
    createdUserIds.push(id);

    const identity = await loadShellIdentity(sessionFor(id, "pathways"));
    // Home reads a null first name as its cue for the neutral greeting.
    expect(identity.firstName).toBeNull();
    expect(identity.displayName).toBe("Member");
    expect(identity.initials).toBe("—");
  });

  it("returns a null first name when only a surname survives", async () => {
    const id = await insertUser({ firstName: null, lastName: "Whitfield", programRole: "pathways" });
    createdUserIds.push(id);

    const identity = await loadShellIdentity(sessionFor(id, "pathways"));
    expect(identity.firstName).toBeNull();
    expect(identity.displayName).toBe("Whitfield");
  });

  it("never yields an empty program label, so the badge is never blank", async () => {
    const id = await insertUser({ firstName: "Sam", lastName: "Reed", programRole: "none" });
    createdUserIds.push(id);

    const identity = await loadShellIdentity(sessionFor(id, "none"));
    expect(identity.programRoleLabel).toBe("Staff");
    expect(identity.programRoleLabel.length).toBeGreaterThan(0);
  });
});
