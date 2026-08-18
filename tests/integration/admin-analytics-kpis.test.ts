import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import type { SessionClaims } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { env } from "@/lib/env";
import { migrator } from "@/lib/db/migrator";
import { loadAdminAnalytics } from "@/lib/admin-analytics/load";
import * as trackModule from "@/lib/analytics/track";
import { claimsFor } from "@/tests/helpers/prd-matrix";
import { deleteAnnouncementsByHeadlinePrefix } from "@/tests/helpers/announcement-cleanup";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";

const MARKER = `kpi-${randomUUID()}`;
const LAST_MONTH = new Date(Date.UTC(2020, 0, 15));

function mfaAdmin(): SessionClaims {
  return { ...claimsFor("admin")!, mfaSatisfied: true };
}

async function pathwaysNetworkId(): Promise<string> {
  const network = await migrator.network.findUnique({ where: { name: "Pathways to Change" } });
  if (!network) {
    throw new Error("Pathways to Change network missing");
  }
  return network.id;
}

async function insertUser(input: {
  email: string;
  programRole: "pathways" | "lead" | "none";
  adminRole?: "none" | "admin";
  status: "active" | "pending";
}): Promise<string> {
  const id = randomUUID();
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(input.email),
      emailEncrypted: encryptPii(input.email),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii("Kpi"),
      lastNameEncrypted: encryptPii("Fixture"),
      networkId: input.programRole === "none" ? null : await pathwaysNetworkId(),
      programRole: input.programRole,
      adminRole: input.adminRole ?? "none",
      status: input.status,
      joinSource: input.status === "pending" ? "self_registered" : "invited",
    },
  });
  return id;
}

async function insertLogin(userId: string, programRole: string, createdAt: Date): Promise<void> {
  await migrator.auditLog.create({
    data: {
      actorUserId: userId,
      actorRole: programRole,
      action: "login_success",
      ip: "127.0.0.1",
      userAgent: MARKER,
      severity: "info",
      createdAt,
    },
  });
}

async function handCountKpis() {
  const approvedMembers = await migrator.user.count({
    where: { status: "active", programRole: { in: ["pathways", "lead"] } },
  });
  const pendingRegistrations = await migrator.user.count({ where: { status: "pending" } });
  const liveResources = await migrator.resource.count({ where: { deletedAt: null } });
  const uncancelledEvents = await migrator.event.count({ where: { cancelledAt: null } });
  const currentAnnouncements = await migrator.announcement.count({ where: { deletedAt: null } });
  const mamRows = await migrator.$queryRaw<{ id: string; program_role: string }[]>`
    SELECT DISTINCT u.id::text AS id, u.program_role::text AS program_role
    FROM audit_log a
    JOIN users u ON u.id = a.actor_user_id
    WHERE a.action = 'login_success'
      AND a.created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
      AND a.created_at < (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + interval '1 month'
      AND u.status = 'active'
      AND u.program_role IN ('pathways', 'lead')
  `;
  return {
    approvedMembers,
    mam: mamRows.length,
    mamPathways: mamRows.filter((row) => row.program_role === "pathways").length,
    mamLead: mamRows.filter((row) => row.program_role === "lead").length,
    pendingRegistrations,
    liveResources,
    uncancelledEvents,
    currentAnnouncements,
  };
}

describe("admin analytics KPI counts (US1 / SC-002)", () => {
  const createdUserIds: string[] = [];
  const createdResourceIds: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await migrator.auditLog.deleteMany({ where: { userAgent: MARKER } });
    if (createdResourceIds.length > 0) {
      await migrator.resource.deleteMany({ where: { id: { in: createdResourceIds } } });
      createdResourceIds.length = 0;
    }
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    await deleteAnnouncementsByHeadlinePrefix(`${MARKER}-`);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("Independent Test: four cards match a hand count; withdrawn/cancelled omitted; staff-only excluded; Moderator and Pathways see no numbers", async () => {
    const pathwaysMamId = await insertUser({
      email: `${MARKER}-pathways-mam@example.com`,
      programRole: "pathways",
      status: "active",
    });
    const pathwaysIdleId = await insertUser({
      email: `${MARKER}-pathways-idle@example.com`,
      programRole: "pathways",
      status: "active",
    });
    const leadIdleId = await insertUser({
      email: `${MARKER}-lead-idle@example.com`,
      programRole: "lead",
      status: "active",
    });
    const staffId = await insertUser({
      email: `${MARKER}-staff@example.com`,
      programRole: "none",
      adminRole: "admin",
      status: "active",
    });
    const pendingId = await insertUser({
      email: `${MARKER}-pending@example.com`,
      programRole: "pathways",
      status: "pending",
    });
    createdUserIds.push(pathwaysMamId, pathwaysIdleId, leadIdleId, staffId, pendingId);

    await insertLogin(pathwaysMamId, "pathways", new Date());
    await insertLogin(pathwaysIdleId, "pathways", LAST_MONTH);
    await insertLogin(staffId, "admin", new Date());

    const liveResource = await migrator.resource.create({
      data: {
        id: randomUUID(),
        title: `${MARKER}-live-resource`,
        previewText: "live",
        thumbnailObjectKey: "seed/thumb.png",
        sourceLabel: "Amend",
        tags: [],
        fileObjectKey: "seed/file.pdf",
        fileSizeBytes: BigInt(1024),
        fileMimeType: "application/pdf",
        visibility: ["all_authenticated"],
        downloadCount: 0,
        uploadedBy: randomUUID(),
      },
    });
    const withdrawnResource = await migrator.resource.create({
      data: {
        id: randomUUID(),
        title: `${MARKER}-withdrawn-resource`,
        previewText: "withdrawn",
        thumbnailObjectKey: "seed/thumb.png",
        sourceLabel: "Amend",
        tags: [],
        fileObjectKey: "seed/file.pdf",
        fileSizeBytes: BigInt(1024),
        fileMimeType: "application/pdf",
        visibility: ["all_authenticated"],
        downloadCount: 99,
        uploadedBy: randomUUID(),
        deletedAt: new Date(),
      },
    });
    createdResourceIds.push(liveResource.id, withdrawnResource.id);

    await migrator.event.create({
      data: {
        id: randomUUID(),
        title: `${MARKER}-live-event`,
        description: "live",
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
        isVirtual: false,
        visibility: ["all_authenticated"],
        createdBy: randomUUID(),
      },
    });
    await migrator.event.create({
      data: {
        id: randomUUID(),
        title: `${MARKER}-cancelled-event`,
        description: "cancelled",
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
        isVirtual: false,
        visibility: ["all_authenticated"],
        createdBy: randomUUID(),
        cancelledAt: new Date(),
      },
    });

    await migrator.announcement.create({
      data: {
        id: randomUUID(),
        headline: `${MARKER}-current`,
        body: "current",
        visibility: ["all_authenticated"],
        activatesAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60_000),
        createdBy: randomUUID(),
      },
    });
    await migrator.announcement.create({
      data: {
        id: randomUUID(),
        headline: `${MARKER}-withdrawn`,
        body: "withdrawn",
        visibility: ["all_authenticated"],
        activatesAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60_000),
        createdBy: randomUUID(),
        deletedAt: new Date(),
      },
    });

    const expected = await handCountKpis();
    const staffCounted = await migrator.user.count({
      where: { id: staffId, status: "active", programRole: { in: ["pathways", "lead"] } },
    });
    expect(staffCounted).toBe(0);
    expect(expected.mam).toBeGreaterThanOrEqual(1);

    const trackSpy = vi.spyOn(trackModule, "track");
    const auditBefore = await migrator.auditLog.count();
    const after = await loadAdminAnalytics(mfaAdmin(), null);

    expect(after.kpis).toEqual(expected);
    expect(trackSpy).not.toHaveBeenCalled();
    expect(await migrator.auditLog.count()).toBe(auditBefore);

    await expect(loadAdminAnalytics(claimsFor("moderator"), null)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(loadAdminAnalytics(claimsFor("pathways"), null)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });
});
