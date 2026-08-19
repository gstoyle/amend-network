import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { PII_METADATA_KEYS } from "@/lib/audit/write";
import { decryptPii, encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { runRetentionJob } from "@/lib/retention/run";
import { deleteDirectoryRowsForUserIds } from "@/tests/helpers/directory-cleanup";

const MARKER = `retention-job-${randomUUID()}`;
const NOW = new Date("2026-08-18T12:00:00.000Z");

function utcYearsPlusDaysBefore(now: Date, years: number, extraDays: number): Date {
  const value = new Date(now.getTime());
  value.setUTCFullYear(value.getUTCFullYear() - years);
  value.setUTCDate(value.getUTCDate() - extraDays);
  return value;
}

async function insertAudit(input: {
  action: string;
  severity: "security" | "info" | "warning";
  createdAt: Date;
  metadata?: { class: string; count: number };
  targetUserId?: string;
}): Promise<bigint> {
  const row = await migrator.auditLog.create({
    data: {
      actorRole: "system",
      action: input.action,
      ip: "127.0.0.1",
      userAgent: MARKER,
      metadata: input.metadata ?? {},
      severity: input.severity,
      createdAt: input.createdAt,
      targetUserId: input.targetUserId,
    },
  });
  return row.id;
}

async function insertMember(input: {
  email: string;
  status: "active" | "deactivated";
  lastLoginAt: Date;
  firstName: string;
}): Promise<string> {
  const row = await migrator.user.create({
    data: {
      id: randomUUID(),
      emailLookup: hmacEmailLookup(input.email),
      emailEncrypted: encryptPii(input.email),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii(input.firstName),
      lastNameEncrypted: encryptPii("Member"),
      titleEncrypted: encryptPii("Coach"),
      docAffiliationIdEncrypted: encryptPii("doc-1"),
      programRole: "pathways",
      adminRole: "none",
      status: input.status,
      lastLoginAt: input.lastLoginAt,
      registrationIp: "127.0.0.1",
      directoryVisible: true,
    },
  });
  return row.id;
}

async function plantDirectoryLeftovers(userId: string, networkId: string): Promise<void> {
  await migrator.directoryListing.create({
    data: {
      userId,
      programRole: "pathways",
      networkId,
      firstNameEncrypted: encryptPii("Listed"),
      lastNameEncrypted: encryptPii("Person"),
    },
  });
  await migrator.directoryShownTitle.create({
    data: { userId, titleEncrypted: encryptPii("Coach") },
  });
  await migrator.directoryShownDoc.create({
    data: { userId, docAffiliationIdEncrypted: encryptPii("doc-1") },
  });
  await migrator.directoryShownEmail.create({
    data: { userId, emailEncrypted: encryptPii("shown@example.com") },
  });
}

async function plantSessionAndReset(userId: string): Promise<void> {
  await migrator.session.create({
    data: {
      userId,
      tokenHash: randomBytes(32),
      userAgent: MARKER,
      ip: "127.0.0.1",
      lastSeenAt: NOW,
      expiresAt: new Date(NOW.getTime() + 86_400_000),
    },
  });
  await migrator.passwordResetToken.create({
    data: {
      userId,
      tokenHash: randomBytes(32),
      expiresAt: new Date(NOW.getTime() + 3_600_000),
    },
  });
}

describe("retention job audit classes (US1 / contracts/job.md 1–2)", () => {
  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: MARKER } });
    await migrator.auditLog.deleteMany({
      where: { action: "retention_purged", userAgent: "retention-job", createdAt: { gte: NOW } },
    });
  });

  it("Independent Test: 7y+1d security gone, 6y security kept, 3y+1d info and old trail gone, 2y kept, new trails kept, second run adds none", async () => {
    const securityOver = await insertAudit({
      action: "login_success",
      severity: "security",
      createdAt: utcYearsPlusDaysBefore(NOW, 7, 1),
    });
    const securityInWindow = await insertAudit({
      action: "login_success",
      severity: "security",
      createdAt: utcYearsPlusDaysBefore(NOW, 6, 0),
    });
    const infoOver = await insertAudit({
      action: "logout",
      severity: "info",
      createdAt: utcYearsPlusDaysBefore(NOW, 3, 1),
    });
    const infoInWindow = await insertAudit({
      action: "logout",
      severity: "info",
      createdAt: utcYearsPlusDaysBefore(NOW, 2, 0),
    });
    const oldTrail = await insertAudit({
      action: "retention_purged",
      severity: "info",
      createdAt: utcYearsPlusDaysBefore(NOW, 3, 1),
      metadata: { class: "audit_security", count: 4 },
    });
    const trailInWindow = await insertAudit({
      action: "retention_purged",
      severity: "info",
      createdAt: utcYearsPlusDaysBefore(NOW, 2, 0),
      metadata: { class: "audit_other", count: 2 },
    });

    const first = await runRetentionJob(NOW);
    expect(first.auditSecurityDeleted).toBe(1);
    expect(first.auditOtherDeleted).toBe(2);

    expect(await migrator.auditLog.findUnique({ where: { id: securityOver } })).toBeNull();
    expect(await migrator.auditLog.findUnique({ where: { id: infoOver } })).toBeNull();
    expect(await migrator.auditLog.findUnique({ where: { id: oldTrail } })).toBeNull();
    expect(await migrator.auditLog.findUnique({ where: { id: securityInWindow } })).not.toBeNull();
    expect(await migrator.auditLog.findUnique({ where: { id: infoInWindow } })).not.toBeNull();
    expect(await migrator.auditLog.findUnique({ where: { id: trailInWindow } })).not.toBeNull();

    const newTrails = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        severity: "info",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
      orderBy: { id: "asc" },
    });
    expect(newTrails).toHaveLength(2);
    const classes = newTrails.map((row) => {
      const metadata = row.metadata as { class: string; count: number };
      expect(Object.keys(metadata).sort()).toEqual(["class", "count"]);
      for (const key of Object.keys(metadata)) {
        expect(PII_METADATA_KEYS.has(key.toLowerCase())).toBe(false);
      }
      return metadata;
    });
    expect(classes).toEqual(
      expect.arrayContaining([
        { class: "audit_security", count: 1 },
        { class: "audit_other", count: 2 },
      ]),
    );

    const second = await runRetentionJob(NOW);
    expect(second.auditSecurityDeleted).toBe(0);
    expect(second.auditOtherDeleted).toBe(0);
    const trailsAfterSecond = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        severity: "info",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
    });
    expect(trailsAfterSecond).toHaveLength(2);
  });
});

describe("retention job user anonymization (US2 / contracts/job.md 4)", () => {
  const createdUserIds: string[] = [];
  const createdResourceIds: string[] = [];
  const createdEventIds: string[] = [];

  afterEach(async () => {
    if (createdEventIds.length > 0) {
      await migrator.event.deleteMany({ where: { id: { in: createdEventIds } } });
      createdEventIds.length = 0;
    }
    if (createdResourceIds.length > 0) {
      await migrator.resource.deleteMany({ where: { id: { in: createdResourceIds } } });
      createdResourceIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await migrator.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await migrator.passwordResetToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await deleteDirectoryRowsForUserIds(createdUserIds);
      await migrator.auditLog.deleteMany({
        where: { OR: [{ userAgent: MARKER }, { targetUserId: { in: createdUserIds } }] },
      });
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await migrator.auditLog.deleteMany({
      where: { action: "retention_purged", userAgent: "retention-job", createdAt: { gte: NOW } },
    });
  });

  it("Independent Test: 3y+1d deactivated anonymized, leftovers gone, attribution FKs kept, in-window and active unchanged", async () => {
    const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
    if (!network) {
      throw new Error("Pathways to Change network is required");
    }

    const eligibleEmail = `${MARKER}-eligible@example.com`;
    const recentEmail = `${MARKER}-recent@example.com`;
    const activeEmail = `${MARKER}-active@example.com`;
    const eligible = await insertMember({
      email: eligibleEmail,
      status: "deactivated",
      lastLoginAt: utcYearsPlusDaysBefore(NOW, 3, 1),
      firstName: "Eligible",
    });
    const recent = await insertMember({
      email: recentEmail,
      status: "deactivated",
      lastLoginAt: utcYearsPlusDaysBefore(NOW, 2, 0),
      firstName: "Recent",
    });
    const active = await insertMember({
      email: activeEmail,
      status: "active",
      lastLoginAt: utcYearsPlusDaysBefore(NOW, 4, 0),
      firstName: "Active",
    });
    createdUserIds.push(eligible, recent, active);

    await insertAudit({
      action: "account_deactivated",
      severity: "info",
      createdAt: utcYearsPlusDaysBefore(NOW, 3, 1),
      targetUserId: eligible,
    });

    await plantDirectoryLeftovers(eligible, network.id);
    await plantDirectoryLeftovers(recent, network.id);
    await plantSessionAndReset(eligible);
    const resource = await migrator.resource.create({
      data: {
        id: randomUUID(),
        title: `${MARKER}-res`,
        previewText: "preview",
        thumbnailObjectKey: "seed/thumb.png",
        sourceLabel: "Amend",
        tags: [],
        fileObjectKey: "seed/file.pdf",
        fileSizeBytes: BigInt(1024),
        fileMimeType: "application/pdf",
        visibility: ["all_authenticated"],
        uploadedBy: eligible,
      },
    });
    createdResourceIds.push(resource.id);
    const event = await migrator.event.create({
      data: {
        id: randomUUID(),
        title: `${MARKER}-evt`,
        description: "desc",
        startsAt: new Date(NOW.getTime() + 60_000),
        endsAt: new Date(NOW.getTime() + 120_000),
        isVirtual: false,
        visibility: ["all_authenticated"],
        hostUserId: eligible,
        createdBy: eligible,
      },
    });
    createdEventIds.push(event.id);

    const first = await runRetentionJob(NOW);
    expect(first.usersAnonymized).toBe(1);

    const eligibleRow = await migrator.user.findUnique({ where: { id: eligible } });
    if (!eligibleRow) {
      throw new Error("eligible user missing");
    }
    expect(eligibleRow.status).toBe("deactivated");
    expect(decryptPii(eligibleRow.emailEncrypted)).toBe(`anonymized.${eligible}@retention.invalid`);
    expect(decryptPii(eligibleRow.firstNameEncrypted ?? new Uint8Array())).toBe("");
    expect(
      Buffer.from(eligibleRow.emailLookup).equals(Buffer.from(hmacEmailLookup(eligibleEmail))),
    ).toBe(false);

    expect(await migrator.directoryListing.findUnique({ where: { userId: eligible } })).toBeNull();
    expect(await migrator.directoryShownTitle.findUnique({ where: { userId: eligible } })).toBeNull();
    expect(await migrator.directoryShownDoc.findUnique({ where: { userId: eligible } })).toBeNull();
    expect(await migrator.directoryShownEmail.findUnique({ where: { userId: eligible } })).toBeNull();
    expect(await migrator.session.count({ where: { userId: eligible } })).toBe(0);
    expect(await migrator.passwordResetToken.count({ where: { userId: eligible } })).toBe(0);

    expect(await migrator.directoryListing.findUnique({ where: { userId: recent } })).not.toBeNull();
    const recentRow = await migrator.user.findUnique({ where: { id: recent } });
    expect(decryptPii(recentRow?.emailEncrypted ?? new Uint8Array())).toBe(recentEmail);
    const activeRow = await migrator.user.findUnique({ where: { id: active } });
    expect(decryptPii(activeRow?.emailEncrypted ?? new Uint8Array())).toBe(activeEmail);

    expect((await migrator.resource.findUnique({ where: { id: resource.id } }))?.uploadedBy).toBe(
      eligible,
    );
    const eventRow = await migrator.event.findUnique({ where: { id: event.id } });
    expect(eventRow?.hostUserId).toBe(eligible);
    expect(eventRow?.createdBy).toBe(eligible);

    const trails = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
    });
    const anonymizeTrail = trails.find((row) => {
      const metadata = row.metadata as { class: string; count: number };
      return metadata.class === "users_anonymized";
    });
    expect(anonymizeTrail).toBeDefined();
    expect((anonymizeTrail?.metadata as { class: string; count: number }).count).toBe(1);

    const second = await runRetentionJob(NOW);
    expect(second.usersAnonymized).toBe(0);
    const trailsAfter = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
    });
    expect(
      trailsAfter.filter((row) => (row.metadata as { class: string }).class === "users_anonymized"),
    ).toHaveLength(1);
  });
});

describe("retention job leftover tokens (US3 / contracts/job.md 5–6)", () => {
  const createdUserIds: string[] = [];
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    if (createdInvitationIds.length > 0) {
      await migrator.invitation.deleteMany({ where: { id: { in: createdInvitationIds } } });
      createdInvitationIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await migrator.passwordResetToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await migrator.auditLog.deleteMany({
      where: { action: "retention_purged", userAgent: "retention-job", createdAt: { gte: NOW } },
    });
  });

  it("Independent Test: expired/consumed resets gone, valid unused reset kept, expired+revoked invites gone, pending in-window invite kept", async () => {
    const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
    if (!network) {
      throw new Error("Pathways to Change network is required");
    }
    const networkId = network.id;
    const holder = await insertMember({
      email: `${MARKER}-tokens@example.com`,
      status: "active",
      lastLoginAt: NOW,
      firstName: "Token",
    });
    createdUserIds.push(holder);

    const expiredReset = await migrator.passwordResetToken.create({
      data: {
        userId: holder,
        tokenHash: randomBytes(32),
        expiresAt: new Date(NOW.getTime() - 60_000),
      },
    });
    const consumedReset = await migrator.passwordResetToken.create({
      data: {
        userId: holder,
        tokenHash: randomBytes(32),
        expiresAt: new Date(NOW.getTime() + 1_800_000),
        consumedAt: new Date(NOW.getTime() - 1_000),
      },
    });
    const validReset = await migrator.passwordResetToken.create({
      data: {
        userId: holder,
        tokenHash: randomBytes(32),
        expiresAt: new Date(NOW.getTime() + 1_800_000),
      },
    });

    async function insertInvite(
      status: "pending" | "expired" | "revoked",
      expiresAt: Date,
    ): Promise<string> {
      const row = await migrator.invitation.create({
        data: {
          emailLookup: hmacEmailLookup(`${MARKER}-${status}-${randomUUID()}@example.com`),
          emailEncrypted: encryptPii(`${MARKER}-${status}@example.com`),
          tokenHash: randomBytes(32),
          inviterId: holder,
          networkId,
          firstNameEncrypted: encryptPii("Invite"),
          lastNameEncrypted: encryptPii("Eee"),
          status,
          expiresAt,
          revokedAt: status === "revoked" ? NOW : undefined,
        },
      });
      createdInvitationIds.push(row.id);
      return row.id;
    }

    const expiredInvite = await insertInvite("expired", new Date(NOW.getTime() - 86_400_000));
    const revokedInvite = await insertInvite("revoked", new Date(NOW.getTime() + 86_400_000));
    const pendingInvite = await insertInvite(
      "pending",
      new Date(NOW.getTime() + 7 * 86_400_000),
    );

    const first = await runRetentionJob(NOW);
    expect(first.passwordResetTokensDeleted).toBe(2);
    expect(first.invitationsDeleted).toBe(2);

    expect(await migrator.passwordResetToken.findUnique({ where: { id: expiredReset.id } })).toBeNull();
    expect(await migrator.passwordResetToken.findUnique({ where: { id: consumedReset.id } })).toBeNull();
    expect(await migrator.passwordResetToken.findUnique({ where: { id: validReset.id } })).not.toBeNull();

    expect(await migrator.invitation.findUnique({ where: { id: expiredInvite } })).toBeNull();
    expect(await migrator.invitation.findUnique({ where: { id: revokedInvite } })).toBeNull();
    expect(await migrator.invitation.findUnique({ where: { id: pendingInvite } })).not.toBeNull();

    const trails = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
    });
    const classes = trails.map((row) => row.metadata as { class: string; count: number });
    expect(classes).toEqual(
      expect.arrayContaining([
        { class: "password_reset_tokens", count: 2 },
        { class: "invitations", count: 2 },
      ]),
    );

    const second = await runRetentionJob(NOW);
    expect(second.passwordResetTokensDeleted).toBe(0);
    expect(second.invitationsDeleted).toBe(0);
    const trailsAfter = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
    });
    expect(
      trailsAfter.filter(
        (row) => (row.metadata as { class: string }).class === "password_reset_tokens",
      ),
    ).toHaveLength(1);
    expect(
      trailsAfter.filter((row) => (row.metadata as { class: string }).class === "invitations"),
    ).toHaveLength(1);
  });
});

describe("retention job analytics port (US4 / contracts/job.md 3)", () => {
  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: MARKER } });
    await migrator.auditLog.deleteMany({
      where: { action: "retention_purged", userAgent: "retention-job", createdAt: { gte: NOW } },
    });
  });

  it("Independent Test: injected 24-month port deletes old events, keeps younger, writes analytics trail, leaves in-window audit rows", async () => {
    const { createInMemoryAnalyticsRetentionPort } = await import("@/lib/analytics/retention");
    const inWindow = await insertAudit({
      action: "logout",
      severity: "info",
      createdAt: utcYearsPlusDaysBefore(NOW, 1, 0),
    });
    const oldEvent = { id: "old", occurredAt: utcMonthsPlusDaysBefore(NOW, 24, 1) };
    const youngEvent = { id: "young", occurredAt: utcMonthsPlusDaysBefore(NOW, 12, 0) };
    const port = createInMemoryAnalyticsRetentionPort([oldEvent, youngEvent]);

    const first = await runRetentionJob(NOW, { analyticsPort: port });
    expect(first.analyticsDeleted).toBe(1);
    expect(port.snapshot().map((event) => event.id)).toEqual(["young"]);
    expect(await migrator.auditLog.findUnique({ where: { id: inWindow } })).not.toBeNull();

    const trails = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
    });
    expect(
      trails.map((row) => row.metadata as { class: string; count: number }),
    ).toEqual(expect.arrayContaining([{ class: "analytics", count: 1 }]));
  });

  it("default adapter (no PostHog client) returns 0, writes no analytics trail, and does not throw", async () => {
    const inWindow = await insertAudit({
      action: "logout",
      severity: "info",
      createdAt: utcYearsPlusDaysBefore(NOW, 1, 0),
    });

    const first = await runRetentionJob(NOW);
    expect(first.analyticsDeleted).toBe(0);
    expect(await migrator.auditLog.findUnique({ where: { id: inWindow } })).not.toBeNull();

    const trails = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
    });
    expect(
      trails.filter((row) => (row.metadata as { class: string }).class === "analytics"),
    ).toHaveLength(0);
  });

  it("aborts the transaction with no analytics trail when the port throws", async () => {
    const inWindow = await insertAudit({
      action: "logout",
      severity: "info",
      createdAt: utcYearsPlusDaysBefore(NOW, 1, 0),
    });
    const port = {
      async deleteOlderThan(): Promise<number> {
        throw new Error("analytics vendor unavailable");
      },
    };

    await expect(runRetentionJob(NOW, { analyticsPort: port })).rejects.toThrow(
      "analytics vendor unavailable",
    );
    expect(await migrator.auditLog.findUnique({ where: { id: inWindow } })).not.toBeNull();
    const trails = await migrator.auditLog.findMany({
      where: {
        action: "retention_purged",
        userAgent: "retention-job",
        createdAt: { gte: NOW },
      },
    });
    expect(
      trails.filter((row) => (row.metadata as { class: string }).class === "analytics"),
    ).toHaveLength(0);
  });
});

function utcMonthsPlusDaysBefore(now: Date, months: number, extraDays: number): Date {
  const value = new Date(now.getTime());
  value.setUTCMonth(value.getUTCMonth() - months);
  value.setUTCDate(value.getUTCDate() - extraDays);
  return value;
}

