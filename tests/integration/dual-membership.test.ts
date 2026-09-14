import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { createSession, loadSession } from "@/lib/auth/session";
import type { SessionClaims } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import {
  IMMERSION_NETWORK_NAME,
  LEAD_NETWORK_NAME,
  PROGRAM_LABELS,
  listVisibleRecords,
} from "@/lib/db/visibility";
import { env } from "@/lib/env";
import { loadShellIdentity } from "@/lib/profile/identity";
import { listResources } from "@/lib/resources/list";

const MARKER = `dual-int-${randomUUID()}`;

async function insertDualMember(): Promise<string> {
  const immersion = await migrator.network.findUnique({
    where: { name: IMMERSION_NETWORK_NAME },
  });
  const lead = await migrator.network.findUnique({ where: { name: LEAD_NETWORK_NAME } });
  if (!immersion || !lead) {
    throw new Error("launch networks are required");
  }
  const id = randomUUID();
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(`${MARKER}@example.com`),
      emailEncrypted: encryptPii(`${MARKER}@example.com`),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii("Both"),
      lastNameEncrypted: encryptPii("Programmes"),
      networkId: immersion.id,
      programRole: "pathways",
      adminRole: "none",
      status: "active",
    },
  });
  await migrator.userNetwork.create({
    data: { userId: id, networkId: lead.id },
  });
  return id;
}

describe("dual programme membership session", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await migrator.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("loads both programme tokens and both programme content", async () => {
    const userId = await insertDualMember();
    createdUserIds.push(userId);

    const created = await createSession({
      userId,
      ip: "127.0.0.1",
      userAgent: MARKER,
      programRole: "pathways",
      adminRole: "none",
      status: "active",
    });
    const claims = await loadSession(created.sessionId);
    expect(claims?.programRole).toBe("pathways");
    expect(claims?.programRoles).toEqual(expect.arrayContaining(["pathways", "lead"]));

    const titles = (await listVisibleRecords(claims as SessionClaims)).map((row) => row.title);
    expect(titles).toContain("Pathways only");
    expect(titles).toContain("LEAD only");

    const resources = await listResources(claims as SessionClaims);
    const resourceTitles = resources.map((row) => row.title);
    expect(resourceTitles).toContain("Seed Pathways PDF");
    expect(resourceTitles).toContain("Seed LEAD PDF");

    const identity = await loadShellIdentity(claims);
    expect(identity.programRoleLabel).toBe(`${PROGRAM_LABELS.pathways} and ${PROGRAM_LABELS.lead}`);
  });
});
