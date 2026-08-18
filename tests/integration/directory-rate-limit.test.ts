import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import type { SessionClaims } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { listDirectory } from "@/lib/directory/list";
import { saveDirectoryPrivacy } from "@/lib/directory/privacy";
import { deleteDirectoryRowsForUserIds } from "@/tests/helpers/directory-cleanup";

const MARKER = `dir-rate-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;

function auditCtx() {
  return { ip: "127.0.0.1", userAgent: USER_AGENT };
}

function sessionFor(userId: string): SessionClaims {
  return {
    sessionId: `dir-rate-${userId}`,
    userId,
    programRole: "pathways",
    adminRole: "none",
    status: "active",
    mfaEnabled: false,
    mfaSatisfied: false,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function insertListedPathways(lastName: string): Promise<string> {
  const pathwaysNet = await migrator.network.findUnique({ where: { name: "Pathways to Change" } });
  const agency = await migrator.docAffiliation.findUnique({ where: { label: "Test Agency A" } });
  const id = randomUUID();
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(`${MARKER}-${lastName}@example.com`),
      emailEncrypted: encryptPii(`${MARKER}-${lastName}@example.com`),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii("Ada"),
      lastNameEncrypted: encryptPii(lastName),
      titleEncrypted: encryptPii("Member"),
      docAffiliationIdEncrypted: encryptPii(agency!.id),
      networkId: pathwaysNet!.id,
      programRole: "pathways",
      adminRole: "none",
      status: "active",
    },
  });
  await saveDirectoryPrivacy(sessionFor(id), {
    listing: true,
    showTitle: false,
    showDocAffiliation: false,
    showEmail: false,
  }, auditCtx());
  return id;
}

describe("directory search rate limit (US5)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteDirectoryRowsForUserIds(createdUserIds);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    createdUserIds.length = 0;
  });

  it("Independent Test: 30 searches then a 31st refused with no list; a second member can still search", async () => {
    const listedId = await insertListedPathways("RateListed");
    const firstViewer = randomUUID();
    const secondViewer = randomUUID();
    createdUserIds.push(listedId, firstViewer, secondViewer);

    const first = sessionFor(firstViewer);
    const second = sessionFor(secondViewer);

    for (let i = 0; i < 30; i += 1) {
      const allowed = await listDirectory(first, { q: "" });
      expect(allowed.ok).toBe(true);
      if (!allowed.ok) {
        return;
      }
      expect(allowed.members.map((row) => row.id)).toContain(listedId);
    }

    const denied = await listDirectory(first, { q: "" });
    expect(denied.ok).toBe(false);
    if (denied.ok) {
      return;
    }
    expect(denied.error).toMatch(/try again later/i);
    expect("members" in denied ? denied.members : []).toEqual([]);

    const other = await listDirectory(second, { q: "" });
    expect(other.ok).toBe(true);
    if (!other.ok) {
      return;
    }
    expect(other.members.map((row) => row.id)).toContain(listedId);
  });
});
