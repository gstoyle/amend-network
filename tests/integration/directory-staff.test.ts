import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import type { SessionClaims } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { listDirectory } from "@/lib/directory/list";
import { getDirectoryProfile } from "@/lib/directory/profile";
import { saveDirectoryPrivacy } from "@/lib/directory/privacy";
import { deleteDirectoryRowsForUserIds } from "@/tests/helpers/directory-cleanup";

const MARKER = `dir-staff-${randomUUID()}`;
const HIDDEN_TITLE = `StaffHiddenTitle-${MARKER}`;
const USER_AGENT = `vitest-${MARKER}`;

function auditCtx() {
  return { ip: "127.0.0.1", userAgent: USER_AGENT };
}

function sessionFor(
  userId: string,
  programRole: "pathways" | "lead" | "none",
  status: "active" | "pending" = "active",
  adminRole: SessionClaims["adminRole"] = "none",
): SessionClaims {
  return {
    sessionId: `dir-staff-${userId}`,
    userId,
    programRole,
    adminRole,
    status,
    mfaEnabled: false,
    mfaSatisfied: false,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function insertMember(input: {
  email: string;
  lastName: string;
  programRole: "pathways" | "lead";
  title: string;
  networkId: string;
  docId: string;
}): Promise<string> {
  const id = randomUUID();
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(input.email),
      emailEncrypted: encryptPii(input.email),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii("Ada"),
      lastNameEncrypted: encryptPii(input.lastName),
      titleEncrypted: encryptPii(input.title),
      docAffiliationIdEncrypted: encryptPii(input.docId),
      networkId: input.networkId,
      programRole: input.programRole,
      adminRole: "none",
      status: "active",
    },
  });
  return id;
}

describe("directory staff both-programs (US4)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteDirectoryRowsForUserIds(createdUserIds);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    createdUserIds.length = 0;
  });

  it("Independent Test: Admin sees both programs; Pathways sees Pathways only; Admin does not see a hidden DOC field", async () => {
    const pathwaysNet = await migrator.network.findUnique({ where: { name: "Pathways to Change" } });
    const leadNet = await migrator.network.findUnique({ where: { name: "LEAD" } });
    const agency = await migrator.docAffiliation.findUnique({ where: { label: "Test Agency A" } });
    expect(pathwaysNet).not.toBeNull();
    expect(leadNet).not.toBeNull();
    expect(agency).not.toBeNull();

    const pathwaysId = await insertMember({
      email: `${MARKER}-pathways@example.com`,
      lastName: "PathwaysHideDoc",
      programRole: "pathways",
      title: HIDDEN_TITLE,
      networkId: pathwaysNet!.id,
      docId: agency!.id,
    });
    const leadId = await insertMember({
      email: `${MARKER}-lead@example.com`,
      lastName: "LeadShowDoc",
      programRole: "lead",
      title: "Member",
      networkId: leadNet!.id,
      docId: agency!.id,
    });
    const adminId = randomUUID();
    const moderatorId = randomUUID();
    createdUserIds.push(pathwaysId, leadId, adminId, moderatorId);

    await saveDirectoryPrivacy(sessionFor(pathwaysId, "pathways"), {
      listing: true,
      showTitle: false,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());
    await saveDirectoryPrivacy(sessionFor(leadId, "lead"), {
      listing: true,
      showTitle: false,
      showDocAffiliation: true,
      showEmail: false,
    }, auditCtx());

    const admin = sessionFor(adminId, "none", "active", "admin");
    const moderator = sessionFor(moderatorId, "none", "active", "moderator");
    const pathwaysPeer = sessionFor(randomUUID(), "pathways");

    const adminList = await listDirectory(admin, { q: "" });
    expect(adminList.ok).toBe(true);
    if (!adminList.ok) {
      return;
    }
    const adminIds = adminList.members.map((row) => row.id);
    expect(adminIds).toContain(pathwaysId);
    expect(adminIds).toContain(leadId);
    const adminPathways = adminList.members.find((row) => row.id === pathwaysId);
    expect(adminPathways?.docLabel).toBeUndefined();
    expect(adminPathways?.title).toBeUndefined();
    expect(adminPathways?.email).toBeUndefined();
    expect(adminPathways?.docLabel === "").toBe(false);
    const adminLead = adminList.members.find((row) => row.id === leadId);
    expect(adminLead?.docLabel).toBe("Test Agency A");

    const moderatorList = await listDirectory(moderator, { q: "" });
    expect(moderatorList.ok).toBe(true);
    if (!moderatorList.ok) {
      return;
    }
    expect(moderatorList.members.map((row) => row.id)).toContain(pathwaysId);
    expect(moderatorList.members.map((row) => row.id)).toContain(leadId);

    const memberList = await listDirectory(pathwaysPeer, { q: "" });
    expect(memberList.ok).toBe(true);
    if (!memberList.ok) {
      return;
    }
    expect(memberList.members.map((row) => row.id)).toContain(pathwaysId);
    expect(memberList.members.map((row) => row.id)).not.toContain(leadId);

    const hiddenDocHits = await listDirectory(admin, { q: "Test Agency A" });
    expect(hiddenDocHits.ok).toBe(true);
    if (!hiddenDocHits.ok) {
      return;
    }
    expect(hiddenDocHits.members.map((row) => row.id)).not.toContain(pathwaysId);
    expect(hiddenDocHits.members.map((row) => row.id)).toContain(leadId);

    const hiddenTitleHits = await listDirectory(admin, { q: HIDDEN_TITLE });
    expect(hiddenTitleHits.ok).toBe(true);
    if (!hiddenTitleHits.ok) {
      return;
    }
    expect(hiddenTitleHits.members.map((row) => row.id)).not.toContain(pathwaysId);

    const adminProfile = await getDirectoryProfile(admin, pathwaysId, auditCtx());
    expect(adminProfile).not.toBeNull();
    expect(adminProfile?.docLabel).toBeUndefined();
    expect(adminProfile?.title).toBeUndefined();
    expect(adminProfile?.email).toBeUndefined();
    expect(adminProfile).toEqual(adminPathways);

    const adminLeadProfile = await getDirectoryProfile(admin, leadId, auditCtx());
    expect(adminLeadProfile?.docLabel).toBe("Test Agency A");

    const memberLeadProfile = await getDirectoryProfile(pathwaysPeer, leadId, auditCtx());
    expect(memberLeadProfile).toBeNull();
  });
});
