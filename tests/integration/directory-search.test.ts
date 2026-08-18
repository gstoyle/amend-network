import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import type { SessionClaims } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { listDirectory } from "@/lib/directory/list";
import { saveDirectoryPrivacy } from "@/lib/directory/privacy";
import { deleteDirectoryRowsForUserIds } from "@/tests/helpers/directory-cleanup";

const MARKER = `dir-search-${randomUUID()}`;
const HIDDEN_TITLE = `HiddenTitle-${MARKER}`;
const SHOWN_TITLE = `Coach-${MARKER}`;
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
    sessionId: `dir-search-${userId}`,
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

describe("directory list/search (US2)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteDirectoryRowsForUserIds(createdUserIds);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    createdUserIds.length = 0;
  });

  it("Independent Test: Pathways sees Pathways only; hidden title/DOC are not matches; pending sees zero", async () => {
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
    const titledId = await insertMember({
      email: `${MARKER}-titled@example.com`,
      lastName: "Titled",
      programRole: "pathways",
      title: SHOWN_TITLE,
      networkId: pathwaysNet!.id,
      docId: agency!.id,
    });
    const hiddenTitleId = await insertMember({
      email: `${MARKER}-hidetitle@example.com`,
      lastName: "HideTitle",
      programRole: "pathways",
      title: HIDDEN_TITLE,
      networkId: pathwaysNet!.id,
      docId: agency!.id,
    });
    const leadId = await insertMember({
      email: `${MARKER}-lead@example.com`,
      lastName: "LeadDoc",
      programRole: "lead",
      title: "Member",
      networkId: leadNet!.id,
      docId: agency!.id,
    });
    const pendingId = await insertMember({
      email: `${MARKER}-pending@example.com`,
      lastName: "Pending",
      programRole: "pathways",
      status: "pending",
      title: "Member",
      networkId: pathwaysNet!.id,
      docId: agency!.id,
    });
    createdUserIds.push(viewerId, titledId, hiddenTitleId, leadId, pendingId);

    await saveDirectoryPrivacy(sessionFor(titledId, "pathways"), {
      listing: true,
      showTitle: true,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());
    await saveDirectoryPrivacy(sessionFor(hiddenTitleId, "pathways"), {
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

    const pathways = sessionFor(viewerId, "pathways");
    const lead = sessionFor(leadId, "lead");
    const pending = sessionFor(pendingId, "pathways", "pending");

    const empty = await listDirectory(pathways, { q: "" });
    expect(empty.ok).toBe(true);
    if (!empty.ok) {
      return;
    }
    const emptyIds = empty.members.map((row) => row.id);
    expect(emptyIds).toContain(titledId);
    expect(emptyIds).toContain(hiddenTitleId);
    expect(emptyIds).not.toContain(leadId);
    expect(emptyIds).not.toContain(viewerId);

    const leadList = await listDirectory(lead, { q: "" });
    expect(leadList.ok).toBe(true);
    if (!leadList.ok) {
      return;
    }
    const leadIds = leadList.members.map((row) => row.id);
    expect(leadIds).toContain(leadId);
    expect(leadIds).not.toContain(titledId);

    const byTitle = await listDirectory(pathways, { q: SHOWN_TITLE });
    expect(byTitle.ok).toBe(true);
    if (!byTitle.ok) {
      return;
    }
    expect(byTitle.members.map((row) => row.id)).toEqual([titledId]);
    expect(byTitle.members[0]?.title).toBe(SHOWN_TITLE);
    expect(byTitle.members[0]?.docLabel).toBeUndefined();

    const hiddenTitleHits = await listDirectory(pathways, { q: HIDDEN_TITLE });
    expect(hiddenTitleHits.ok).toBe(true);
    if (!hiddenTitleHits.ok) {
      return;
    }
    expect(hiddenTitleHits.members.map((row) => row.id)).not.toContain(hiddenTitleId);
    expect(hiddenTitleHits.members.some((row) => row.title === "" && row.id === hiddenTitleId)).toBe(
      false,
    );

    const hiddenDocHits = await listDirectory(pathways, { q: "Test Agency A" });
    expect(hiddenDocHits.ok).toBe(true);
    if (!hiddenDocHits.ok) {
      return;
    }
    expect(hiddenDocHits.members.map((row) => row.id)).not.toContain(titledId);
    expect(hiddenDocHits.members.some((row) => row.id === titledId && row.docLabel === "")).toBe(
      false,
    );

    const leadDocHits = await listDirectory(lead, { q: "Test Agency A" });
    expect(leadDocHits.ok).toBe(true);
    if (!leadDocHits.ok) {
      return;
    }
    expect(leadDocHits.members.map((row) => row.id)).toContain(leadId);
    expect(leadDocHits.members.find((row) => row.id === leadId)?.docLabel).toBe("Test Agency A");

    await expect(listDirectory(pending, { q: "" })).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("client-supplied role cannot reveal a LEAD listing to Pathways", async () => {
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

    const result = await listDirectory(sessionFor(randomUUID(), "pathways"), {
      q: "",
      clientProgramRole: "lead",
      clientAdminRole: "admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.members.map((row) => row.id)).not.toContain(leadId);
  });
});
