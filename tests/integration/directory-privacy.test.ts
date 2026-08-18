import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import type { SessionClaims } from "@/lib/auth/types";
import { decryptPii, encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { env } from "@/lib/env";
import { saveDirectoryPrivacy } from "@/lib/directory/privacy";
import { deleteDirectoryRowsForUserIds } from "@/tests/helpers/directory-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `dir-priv-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

function auditCtx() {
  return { ip: IP, userAgent: USER_AGENT };
}

function sessionFor(
  userId: string,
  programRole: "pathways" | "lead" | "none",
  status: "active" | "pending" = "active",
  adminRole: SessionClaims["adminRole"] = "none",
): SessionClaims {
  return {
    sessionId: `dir-priv-${userId}`,
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
  programRole: "pathways" | "lead" | "none";
  status?: "active" | "pending";
  adminRole?: SessionClaims["adminRole"];
  title?: string;
  networkId?: string | null;
}): Promise<string> {
  const id = randomUUID();
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(input.email),
      emailEncrypted: encryptPii(input.email),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii("Ada"),
      lastNameEncrypted: encryptPii(input.email.split("@")[0] ?? "Member"),
      titleEncrypted: encryptPii(input.title ?? "Coach"),
      networkId: input.networkId ?? undefined,
      programRole: input.programRole,
      adminRole: input.adminRole ?? "none",
      status: input.status ?? "active",
    },
  });
  return id;
}

async function listingsAs(
  viewer: SessionClaims,
  subjectId: string,
): Promise<{ userId: string; networkId: string; firstName: string; lastName: string }[]> {
  const rows = await withRls(
    {
      userId: viewer.userId,
      programRole: viewer.programRole,
      adminRole: viewer.adminRole,
      status: viewer.status,
    },
    (tx) =>
      tx.directoryListing.findMany({
        where: { userId: subjectId },
        select: {
          userId: true,
          networkId: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
        },
      }),
  );
  return rows.map((row) => ({
    userId: row.userId,
    networkId: row.networkId,
    firstName: decryptPii(row.firstNameEncrypted),
    lastName: decryptPii(row.lastNameEncrypted),
  }));
}

describe("directory privacy save (US1)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteDirectoryRowsForUserIds(createdUserIds);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    createdUserIds.length = 0;
  });

  it("Independent Test: opted-out A is hidden; opted-in B shows name, network, title, not DOC/email; pending cannot list", async () => {
    const network = await migrator.network.findUnique({ where: { name: "Pathways to Change" } });
    expect(network).not.toBeNull();
    const networkId = network!.id;

    const viewerId = await insertMember({
      email: `${MARKER}-viewer@example.com`,
      programRole: "pathways",
      networkId,
    });
    const optedOutId = await insertMember({
      email: `${MARKER}-opted-out@example.com`,
      programRole: "pathways",
      networkId,
    });
    const listedId = await insertMember({
      email: `${MARKER}-listed@example.com`,
      programRole: "pathways",
      networkId,
      title: "Coach",
    });
    const pendingId = await insertMember({
      email: `${MARKER}-pending@example.com`,
      programRole: "pathways",
      status: "pending",
      networkId,
    });
    createdUserIds.push(viewerId, optedOutId, listedId, pendingId);

    const viewer = sessionFor(viewerId, "pathways");
    const listed = sessionFor(listedId, "pathways");
    const pending = sessionFor(pendingId, "pathways", "pending");

    const saved = await saveDirectoryPrivacy(listed, {
      listing: true,
      showTitle: true,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());
    expect(saved).toEqual({ ok: true, listed: true });

    expect(await listingsAs(viewer, optedOutId)).toEqual([]);

    const visible = await listingsAs(viewer, listedId);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.firstName).toBe("Ada");
    expect(visible[0]?.networkId).toBe(networkId);

    const titles = await withRls(viewer, (tx) =>
      tx.directoryShownTitle.findMany({ where: { userId: listedId } }),
    );
    expect(titles).toHaveLength(1);
    expect(decryptPii(titles[0]!.titleEncrypted)).toBe("Coach");

    const docs = await withRls(viewer, (tx) =>
      tx.directoryShownDoc.findMany({ where: { userId: listedId } }),
    );
    const emails = await withRls(viewer, (tx) =>
      tx.directoryShownEmail.findMany({ where: { userId: listedId } }),
    );
    expect(docs).toEqual([]);
    expect(emails).toEqual([]);

    await expect(
      saveDirectoryPrivacy(pending, {
        listing: true,
        showTitle: false,
        showDocAffiliation: false,
        showEmail: false,
      }, auditCtx()),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    const pendingListings = await migrator.directoryListing.findMany({
      where: { userId: pendingId },
    });
    expect(pendingListings).toEqual([]);
  });

  it("opt-in writes directory_privacy_changed without PII in metadata", async () => {
    const network = await migrator.network.findUnique({ where: { name: "Pathways to Change" } });
    const userId = await insertMember({
      email: `${MARKER}-audit@example.com`,
      programRole: "pathways",
      networkId: network!.id,
      title: "Coach",
    });
    createdUserIds.push(userId);

    await saveDirectoryPrivacy(sessionFor(userId, "pathways"), {
      listing: true,
      showTitle: true,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());

    const audits = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, action: "directory_privacy_changed" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.entityType).toBe("user");
    expect(audits[0]?.entityId).toBe(userId);
    const metadata = JSON.stringify(audits[0]?.metadata ?? {});
    expect(metadata).not.toContain("@");
    expect(metadata).not.toContain("Ada");
    expect(metadata).not.toContain("Coach");
    expect(metadata).not.toContain(MARKER);
    expect(audits[0]?.metadata).toMatchObject({ listing: true, showTitle: true });
  });

  it("hiding title deletes the shown-title row and writes audit", async () => {
    const network = await migrator.network.findUnique({ where: { name: "Pathways to Change" } });
    const userId = await insertMember({
      email: `${MARKER}-hide@example.com`,
      programRole: "pathways",
      networkId: network!.id,
      title: "Coach",
    });
    createdUserIds.push(userId);
    const session = sessionFor(userId, "pathways");

    await saveDirectoryPrivacy(session, {
      listing: true,
      showTitle: true,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());
    await saveDirectoryPrivacy(session, {
      listing: true,
      showTitle: false,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());

    const titles = await migrator.directoryShownTitle.findMany({ where: { userId } });
    expect(titles).toEqual([]);
    const audits = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, action: "directory_privacy_changed" },
      orderBy: { createdAt: "asc" },
    });
    expect(audits).toHaveLength(2);
    expect(audits[1]?.metadata).toMatchObject({ showTitle: false });
  });

  it("opt-out deletes listing and shown-field rows immediately", async () => {
    const network = await migrator.network.findUnique({ where: { name: "Pathways to Change" } });
    const userId = await insertMember({
      email: `${MARKER}-out@example.com`,
      programRole: "pathways",
      networkId: network!.id,
    });
    createdUserIds.push(userId);
    const session = sessionFor(userId, "pathways");

    await saveDirectoryPrivacy(session, {
      listing: true,
      showTitle: true,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());
    await saveDirectoryPrivacy(session, {
      listing: false,
      showTitle: true,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());

    expect(await migrator.directoryListing.findMany({ where: { userId } })).toEqual([]);
    expect(await migrator.directoryShownTitle.findMany({ where: { userId } })).toEqual([]);
    const audits = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, action: "directory_privacy_changed" },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.at(-1)?.metadata).toMatchObject({ listing: false });
  });

  it("staff-only accounts cannot insert a listing row", async () => {
    const userId = await insertMember({
      email: `${MARKER}-staff@example.com`,
      programRole: "none",
      adminRole: "admin",
    });
    createdUserIds.push(userId);

    const result = await saveDirectoryPrivacy(
      sessionFor(userId, "none", "active", "admin"),
      {
        listing: true,
        showTitle: true,
        showDocAffiliation: false,
        showEmail: false,
      },
      auditCtx(),
    );
    expect(result).toEqual({ ok: true, listed: false });
    expect(await migrator.directoryListing.findMany({ where: { userId } })).toEqual([]);
  });

  it("validation failure does not write directory_privacy_changed", async () => {
    const userId = await insertMember({
      email: `${MARKER}-nonet@example.com`,
      programRole: "pathways",
      networkId: null,
    });
    createdUserIds.push(userId);

    const result = await saveDirectoryPrivacy(sessionFor(userId, "pathways"), {
      listing: true,
      showTitle: false,
      showDocAffiliation: false,
      showEmail: false,
    }, auditCtx());
    expect(result.ok).toBe(false);
    const audits = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, action: "directory_privacy_changed" },
    });
    expect(audits).toEqual([]);
    expect(await migrator.directoryListing.findMany({ where: { userId } })).toEqual([]);
  });

  it("client-supplied role cannot opt in a pending user", async () => {
    await expect(
      saveDirectoryPrivacy(claimsFor("pending"), {
        listing: true,
        showTitle: false,
        showDocAffiliation: false,
        showEmail: false,
        clientProgramRole: "pathways",
        clientAdminRole: "none",
      }, auditCtx()),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
  });
});
