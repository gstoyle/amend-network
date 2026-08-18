import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { track } from "@/lib/analytics/track";
import { hashPassword } from "@/lib/auth/password";
import type { SessionClaims } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { listDirectory } from "@/lib/directory/list";
import { getDirectoryProfile } from "@/lib/directory/profile";
import { saveDirectoryPrivacy } from "@/lib/directory/privacy";
import { deleteDirectoryRowsForUserIds } from "@/tests/helpers/directory-cleanup";

const MARKER = `dir-profile-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const SHOWN_EMAIL = `${MARKER}-shown@example.com`;

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
    sessionId: `dir-profile-${userId}`,
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
  status?: "active" | "pending";
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
      status: input.status ?? "active",
    },
  });
  return id;
}

describe("directory profile (US3)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteDirectoryRowsForUserIds(createdUserIds);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    createdUserIds.length = 0;
  });

  it("Independent Test: peer sees shown email not hidden DOC; LEAD withheld; other-member view audits", async () => {
    const pathwaysNet = await migrator.network.findUnique({ where: { name: "Pathways to Change" } });
    const leadNet = await migrator.network.findUnique({ where: { name: "LEAD" } });
    const agency = await migrator.docAffiliation.findUnique({ where: { label: "Test Agency A" } });
    expect(pathwaysNet).not.toBeNull();
    expect(leadNet).not.toBeNull();
    expect(agency).not.toBeNull();

    const viewerId = await insertMember({
      email: `${MARKER}-viewer@example.com`,
      lastName: "Viewer",
      programRole: "pathways",
      title: "Member",
      networkId: pathwaysNet!.id,
      docId: agency!.id,
    });
    const subjectId = await insertMember({
      email: SHOWN_EMAIL,
      lastName: "Subject",
      programRole: "pathways",
      title: "Coach",
      networkId: pathwaysNet!.id,
      docId: agency!.id,
    });
    const leadId = await insertMember({
      email: `${MARKER}-lead@example.com`,
      lastName: "LeadHidden",
      programRole: "lead",
      title: "Member",
      networkId: leadNet!.id,
      docId: agency!.id,
    });
    const unlistedId = await insertMember({
      email: `${MARKER}-unlisted@example.com`,
      lastName: "Unlisted",
      programRole: "pathways",
      title: "Member",
      networkId: pathwaysNet!.id,
      docId: agency!.id,
    });
    createdUserIds.push(viewerId, subjectId, leadId, unlistedId);

    await saveDirectoryPrivacy(sessionFor(subjectId, "pathways"), {
      listing: true,
      showTitle: false,
      showDocAffiliation: false,
      showEmail: true,
    }, auditCtx());
    await saveDirectoryPrivacy(sessionFor(leadId, "lead"), {
      listing: true,
      showTitle: false,
      showDocAffiliation: true,
      showEmail: false,
    }, auditCtx());

    const peer = sessionFor(viewerId, "pathways");
    const lead = sessionFor(leadId, "lead");
    const subject = sessionFor(subjectId, "pathways");

    const listed = await listDirectory(peer, { q: "" });
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    const listRow = listed.members.find((row) => row.id === subjectId);
    expect(listRow).toBeDefined();

    const profile = await getDirectoryProfile(peer, subjectId, auditCtx());
    expect(profile).not.toBeNull();
    expect(profile?.displayName).toBe("Ada Subject");
    expect(profile?.networkLabel).toBe("Pathways to Change");
    expect(profile?.initials).toBe("AS");
    expect(profile?.email).toBe(SHOWN_EMAIL);
    expect(profile?.docLabel).toBeUndefined();
    expect(profile?.title).toBeUndefined();
    expect(profile?.docLabel === "").toBe(false);
    expect(profile).toEqual(listRow);

    const views = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, action: "directory_profile_viewed" },
    });
    expect(views).toHaveLength(1);
    expect(views[0]?.actorUserId).toBe(viewerId);
    expect(views[0]?.targetUserId).toBe(subjectId);
    expect(views[0]?.metadata).toEqual({});
    const extra = JSON.stringify(views[0]?.metadata ?? {});
    expect(extra).not.toMatch(/Ada|Subject|Coach|Test Agency|@example/i);

    const leadView = await getDirectoryProfile(lead, subjectId, auditCtx());
    expect(leadView).toBeNull();

    const unlistedView = await getDirectoryProfile(peer, unlistedId, auditCtx());
    expect(unlistedView).toBeNull();

    const afterWithhold = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, action: "directory_profile_viewed" },
    });
    expect(afterWithhold).toHaveLength(1);

    const selfView = await getDirectoryProfile(subject, subjectId, auditCtx());
    expect(selfView).toEqual(profile);
    const afterSelf = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, action: "directory_profile_viewed" },
    });
    expect(afterSelf).toHaveLength(1);
  });

  it("client-supplied role cannot open a LEAD profile as Pathways", async () => {
    const leadNet = await migrator.network.findUnique({ where: { name: "LEAD" } });
    const agency = await migrator.docAffiliation.findUnique({ where: { label: "Test Agency A" } });
    const leadId = await insertMember({
      email: `${MARKER}-xlead@example.com`,
      lastName: "Cross",
      programRole: "lead",
      title: "Member",
      networkId: leadNet!.id,
      docId: agency!.id,
    });
    createdUserIds.push(leadId);
    await saveDirectoryPrivacy(sessionFor(leadId, "lead"), {
      listing: true,
      showTitle: false,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());

    const result = await getDirectoryProfile(
      sessionFor(randomUUID(), "pathways"),
      leadId,
      auditCtx(),
      { clientProgramRole: "lead", clientAdminRole: "admin" },
    );
    expect(result).toBeNull();
  });

  it("directory_profile_viewed analytics allow viewedUserId and reject PII or query (SC-011)", () => {
    const opaque = {
      distinctId: "00000000-0000-4000-8000-000000000001",
      programRole: "pathways",
      adminRole: "none",
      viewedUserId: "00000000-0000-4000-8000-000000000002",
    };
    expect(() => track("directory_profile_viewed", opaque)).not.toThrow();
    expect(() =>
      track("directory_profile_viewed", { ...opaque, name: "Ada Subject" } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("directory_profile_viewed", { ...opaque, email: SHOWN_EMAIL } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("directory_profile_viewed", { ...opaque, title: "Coach" } as never),
    ).toThrowError(/analytics payload/);
    expect(() =>
      track("directory_profile_viewed", { ...opaque, query: "Test Agency A" } as never),
    ).toThrowError(/analytics payload/);
  });
});
