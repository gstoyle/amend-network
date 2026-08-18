import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import type { SessionClaims } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { env } from "@/lib/env";
import { migrator } from "@/lib/db/migrator";
import { loadAdminAnalytics } from "@/lib/admin-analytics/load";
import type { AdminAnalyticsFunnel } from "@/lib/admin-analytics/types";
import { AdminFunnel } from "@/components/admin-funnel";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `funnel-${randomUUID()}`;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_NETWORK = "00000000-0000-4000-8000-000000000099";

function mfaAdmin(): SessionClaims {
  return { ...claimsFor("admin")!, mfaSatisfied: true };
}

async function networkByName(name: "Pathways to Change" | "LEAD"): Promise<{ id: string; name: string }> {
  const network = await migrator.network.findUnique({ where: { name } });
  if (!network) {
    throw new Error(`${name} network missing`);
  }
  return { id: network.id, name: network.name };
}

async function insertInvitation(networkId: string, email: string, status: "pending" | "accepted"): Promise<string> {
  const id = randomUUID();
  await migrator.invitation.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(email),
      emailEncrypted: encryptPii(email),
      tokenHash: Buffer.from(id.replaceAll("-", ""), "hex"),
      inviterId: randomUUID(),
      networkId,
      firstNameEncrypted: encryptPii("Funnel"),
      lastNameEncrypted: encryptPii("Invite"),
      status,
      expiresAt: new Date(Date.now() + 14 * DAY_MS),
      acceptedAt: status === "accepted" ? new Date() : null,
    },
  });
  return id;
}

async function insertUser(input: {
  email: string;
  programRole: "pathways" | "lead";
  networkId: string;
  status: "active" | "pending" | "denied";
  joinSource: "invited" | "self_registered";
  createdAt: Date;
}): Promise<string> {
  const id = randomUUID();
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(input.email),
      emailEncrypted: encryptPii(input.email),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii("Funnel"),
      lastNameEncrypted: encryptPii("Member"),
      networkId: input.networkId,
      programRole: input.programRole,
      adminRole: "none",
      status: input.status,
      joinSource: input.joinSource,
      createdAt: input.createdAt,
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

async function handCountFunnel(networkId: string | null): Promise<AdminAnalyticsFunnel> {
  const rows = await migrator.$queryRaw<
    {
      invitation: number;
      registration: number;
      approval: number;
      first_login: number;
      retention_eligible: number;
      retained: number;
    }[]
  >`
    WITH registration_set AS (
      SELECT u.id, u.status, u.join_source, u.created_at
      FROM users u
      WHERE u.join_source IS NOT NULL
        AND (${networkId}::uuid IS NULL OR u.network_id = ${networkId}::uuid)
    ),
    approval_set AS (
      SELECT r.*
      FROM registration_set r
      WHERE r.join_source = 'invited'
         OR (r.join_source = 'self_registered' AND r.status IN ('active', 'deactivated'))
    ),
    approval_times AS (
      SELECT
        a.id,
        CASE
          WHEN a.join_source = 'invited' THEN a.created_at
          ELSE (
            SELECT min(al.created_at)
            FROM audit_log al
            WHERE al.action = 'registration_approved'
              AND al.target_user_id = a.id
          )
        END AS approved_at
      FROM approval_set a
    ),
    first_logins AS (
      SELECT t.id, min(l.created_at) AS first_login_at
      FROM approval_times t
      JOIN audit_log l
        ON l.actor_user_id = t.id
       AND l.action = 'login_success'
       AND t.approved_at IS NOT NULL
       AND l.created_at >= t.approved_at
      GROUP BY t.id
    )
    SELECT
      (
        SELECT count(*)::int FROM invitations i
        WHERE ${networkId}::uuid IS NULL OR i.network_id = ${networkId}::uuid
      ) AS invitation,
      (SELECT count(*)::int FROM registration_set) AS registration,
      (SELECT count(*)::int FROM approval_set) AS approval,
      (SELECT count(*)::int FROM first_logins) AS first_login,
      (
        SELECT count(*)::int FROM first_logins
        WHERE first_login_at <= now() - interval '30 days'
      ) AS retention_eligible,
      (
        SELECT count(*)::int FROM first_logins f
        WHERE f.first_login_at <= now() - interval '30 days'
          AND EXISTS (
            SELECT 1 FROM audit_log l
            WHERE l.actor_user_id = f.id
              AND l.action = 'login_success'
              AND l.created_at > f.first_login_at
              AND l.created_at <= f.first_login_at + interval '30 days'
          )
      ) AS retained
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("funnel hand count missing");
  }
  return {
    invitation: row.invitation,
    registration: row.registration,
    approval: row.approval,
    firstLogin: row.first_login,
    retentionEligible: row.retention_eligible,
    retained: row.retained,
  };
}

describe("admin analytics funnel (US2 / SC-004)", () => {
  const createdUserIds: string[] = [];
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: MARKER } });
    if (createdInvitationIds.length > 0) {
      await migrator.invitation.deleteMany({ where: { id: { in: createdInvitationIds } } });
      createdInvitationIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("Independent Test: Pathways invite completed with two logins over 31 days, LEAD pending self-reg, approved never signed in; network filters match research §3", async () => {
    const pathways = await networkByName("Pathways to Change");
    const lead = await networkByName("LEAD");
    const createdAt = new Date(Date.now() - 50 * DAY_MS);
    const firstLoginAt = new Date(Date.now() - 40 * DAY_MS);
    const returnLoginAt = new Date(Date.now() - 25 * DAY_MS);

    const inviteCompletedId = await insertInvitation(
      pathways.id,
      `${MARKER}-pathways-retained@example.com`,
      "accepted",
    );
    const inviteNeverId = await insertInvitation(
      pathways.id,
      `${MARKER}-pathways-never@example.com`,
      "accepted",
    );
    createdInvitationIds.push(inviteCompletedId, inviteNeverId);

    const retainedId = await insertUser({
      email: `${MARKER}-pathways-retained@example.com`,
      programRole: "pathways",
      networkId: pathways.id,
      status: "active",
      joinSource: "invited",
      createdAt,
    });
    const neverSignedInId = await insertUser({
      email: `${MARKER}-pathways-never@example.com`,
      programRole: "pathways",
      networkId: pathways.id,
      status: "active",
      joinSource: "invited",
      createdAt,
    });
    const pendingLeadId = await insertUser({
      email: `${MARKER}-lead-pending@example.com`,
      programRole: "lead",
      networkId: lead.id,
      status: "pending",
      joinSource: "self_registered",
      createdAt: new Date(),
    });
    createdUserIds.push(retainedId, neverSignedInId, pendingLeadId);

    await insertLogin(retainedId, "pathways", firstLoginAt);
    await insertLogin(retainedId, "pathways", returnLoginAt);

    const all = await loadAdminAnalytics(mfaAdmin(), null);
    expect(all.funnel).toEqual(await handCountFunnel(null));

    const pathwaysSnap = await loadAdminAnalytics(mfaAdmin(), pathways.id);
    expect(pathwaysSnap.funnel).toEqual(await handCountFunnel(pathways.id));
    expect(pathwaysSnap.funnel.invitation).toBeGreaterThanOrEqual(2);
    expect(pathwaysSnap.funnel.registration).toBeGreaterThanOrEqual(2);
    expect(pathwaysSnap.funnel.approval).toBeGreaterThanOrEqual(2);
    expect(pathwaysSnap.funnel.firstLogin).toBeGreaterThanOrEqual(1);
    expect(pathwaysSnap.funnel.retentionEligible).toBeGreaterThanOrEqual(1);
    expect(pathwaysSnap.funnel.retained).toBeGreaterThanOrEqual(1);

    const leadSnap = await loadAdminAnalytics(mfaAdmin(), lead.id);
    expect(leadSnap.funnel).toEqual(await handCountFunnel(lead.id));
    expect(leadSnap.funnel.registration).toBeGreaterThanOrEqual(1);
    expect(leadSnap.funnel.approval).toBeLessThan(leadSnap.funnel.registration);
  });

  it("self-reg pending counts at registration only; denied self-reg is not approved", async () => {
    const lead = await networkByName("LEAD");
    const pendingId = await insertUser({
      email: `${MARKER}-pending-only@example.com`,
      programRole: "lead",
      networkId: lead.id,
      status: "pending",
      joinSource: "self_registered",
      createdAt: new Date(),
    });
    const deniedId = await insertUser({
      email: `${MARKER}-denied@example.com`,
      programRole: "lead",
      networkId: lead.id,
      status: "denied",
      joinSource: "self_registered",
      createdAt: new Date(),
    });
    createdUserIds.push(pendingId, deniedId);

    const snap = await loadAdminAnalytics(mfaAdmin(), lead.id);
    expect(snap.funnel).toEqual(await handCountFunnel(lead.id));
    expect(snap.funnel.registration).toBeGreaterThanOrEqual(2);
    expect(snap.funnel.approval).toBeLessThan(snap.funnel.registration);
  });

  it("retention omits first login younger than 30 days from the denominator (not counted as not-retained)", async () => {
    const pathways = await networkByName("Pathways to Change");
    const createdAt = new Date(Date.now() - 20 * DAY_MS);
    const recentFirst = new Date(Date.now() - 10 * DAY_MS);
    const recentReturn = new Date(Date.now() - 5 * DAY_MS);

    const recentId = await insertUser({
      email: `${MARKER}-recent@example.com`,
      programRole: "pathways",
      networkId: pathways.id,
      status: "active",
      joinSource: "invited",
      createdAt,
    });
    createdUserIds.push(recentId);
    await insertLogin(recentId, "pathways", recentFirst);
    await insertLogin(recentId, "pathways", recentReturn);

    const eligibleId = await insertUser({
      email: `${MARKER}-eligible-unretained@example.com`,
      programRole: "pathways",
      networkId: pathways.id,
      status: "active",
      joinSource: "invited",
      createdAt: new Date(Date.now() - 50 * DAY_MS),
    });
    createdUserIds.push(eligibleId);
    await insertLogin(eligibleId, "pathways", new Date(Date.now() - 40 * DAY_MS));

    const snap = await loadAdminAnalytics(mfaAdmin(), null);
    const expected = await handCountFunnel(null);
    expect(snap.funnel).toEqual(expected);

    expect(snap.funnel.firstLogin).toBeGreaterThan(snap.funnel.retentionEligible);
    expect(snap.funnel.retentionEligible).toBeGreaterThanOrEqual(1);
    expect(snap.funnel.firstLogin - snap.funnel.retentionEligible).toBeGreaterThanOrEqual(1);
    expect(snap.funnel.retained).toBeLessThanOrEqual(snap.funnel.retentionEligible);
    expect(snap.funnel.retained).not.toBe(snap.funnel.firstLogin);

    const recentRow = await migrator.$queryRaw<{ first_login_at: Date; eligible: boolean }[]>`
      SELECT min(l.created_at) AS first_login_at,
             (min(l.created_at) <= now() - interval '30 days') AS eligible
      FROM audit_log l
      WHERE l.actor_user_id = ${recentId}::uuid
        AND l.action = 'login_success'
    `;
    expect(recentRow[0]?.eligible).toBe(false);
    expect(recentRow[0]?.first_login_at.getTime()).toBeGreaterThan(Date.now() - 30 * DAY_MS);

    const eligibleRow = await migrator.$queryRaw<{ eligible: boolean }[]>`
      SELECT (min(l.created_at) <= now() - interval '30 days') AS eligible
      FROM audit_log l
      WHERE l.actor_user_id = ${eligibleId}::uuid
        AND l.action = 'login_success'
    `;
    expect(eligibleRow[0]?.eligible).toBe(true);
  });

  it("unknown network uuid returns an empty funnel without throwing", async () => {
    const snap = await loadAdminAnalytics(mfaAdmin(), UNKNOWN_NETWORK);
    expect(snap.funnel).toEqual({
      invitation: 0,
      registration: 0,
      approval: 0,
      firstLogin: 0,
      retentionEligible: 0,
      retained: 0,
    });
  });

  it("Moderator is denied funnel numbers", async () => {
    await expect(loadAdminAnalytics(claimsFor("moderator"), null)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("AdminFunnel last stage uses retentionEligible as denominator, not firstLogin", () => {
    const html = renderToStaticMarkup(
      createElement(AdminFunnel, {
        funnel: {
          invitation: 4,
          registration: 8,
          approval: 6,
          firstLogin: 7,
          retentionEligible: 3,
          retained: 2,
        },
        networkId: null,
        networks: [
          { id: "00000000-0000-4000-8000-000000000001", name: "Pathways to Change" },
          { id: "00000000-0000-4000-8000-000000000002", name: "LEAD" },
        ],
      }),
    );
    expect(html).toMatch(/Invitation/i);
    expect(html).toMatch(/Registration/i);
    expect(html).toMatch(/Approval/i);
    expect(html).toMatch(/First login/i);
    expect(html).toMatch(/30-day retention/i);
    expect(html).toContain("7");
    expect(html).toContain("3");
    expect(html).toContain("2");
    expect(html).toMatch(/not yet eligible|omitted|fewer than 30/i);
    expect(html).not.toMatch(/2\s*(of|\/)\s*7/);
    expect(html).toMatch(/2\s*(of|\/)\s*3/);
  });
});
