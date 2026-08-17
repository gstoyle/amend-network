import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { decryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import {
  approveRegistration,
  denyRegistration,
  listPendingRegistrations,
} from "@/lib/registration/approve";
import { registerSelf } from "@/lib/registration/register";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-approve-${randomUUID()}`;
const PASSWORD = "approve-pass-12";
const DENY_REASON = "not a fit for this cohort";

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

async function mailBodies(): Promise<string[]> {
  const dir = env().EMAIL_JSON_DIR ?? ".tmp/mail";
  try {
    const names = await readdir(dir);
    return Promise.all(names.map((name) => readFile(join(dir, name), "utf8")));
  } catch {
    return [];
  }
}

function countMatching(bodies: string[], ...needles: string[]): number {
  return bodies.filter((body) => needles.every((needle) => body.includes(needle))).length;
}

async function networkByName(name: string) {
  const row = await migrator.network.findFirst({ where: { name } });
  if (!row) {
    throw new Error(`${name} network required`);
  }
  return row;
}

async function activeAffiliation() {
  const row = await migrator.docAffiliation.findFirst({
    where: { label: "Test Agency A", active: true },
  });
  if (!row) {
    throw new Error("Test Agency A required");
  }
  return row;
}

async function registerPending(email: string, networkId: string) {
  const affiliation = await activeAffiliation();
  const result = await registerSelf({
    firstName: "Pat",
    lastName: "Pending",
    title: "Analyst",
    email,
    password: PASSWORD,
    docAffiliationId: affiliation.id,
    networkId,
    ip: IP,
    userAgent: USER_AGENT,
  });
  if (!result.ok) {
    throw new Error("registration failed");
  }
  const user = await migrator.user.findUnique({ where: { emailLookup: hmacEmailLookup(email) } });
  if (!user) {
    throw new Error("pending user missing");
  }
  return user;
}

describe("approval queue (US3 / FR-010–FR-012)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("lists pending oldest-first, filters by network, and rejects a second decision", async () => {
    const pathways = await networkByName("Pathways to Change");
    const lead = await networkByName("LEAD");
    const older = await registerPending(`older-${randomUUID()}@example.com`, pathways.id);
    const newer = await registerPending(`newer-${randomUUID()}@example.com`, lead.id);
    createdUserIds.push(older.id, newer.id);

    const all = await listPendingRegistrations(adminSession());
    const ids = all.map((row) => row.id);
    expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
    expect(all.find((row) => row.id === older.id)?.networkName).toBe("Pathways to Change");
    expect(all.find((row) => row.id === older.id)?.docAffiliationLabel).toBe("Test Agency A");
    expect(all.find((row) => row.id === older.id)?.registrationIp).toBe(IP);

    const filtered = await listPendingRegistrations(adminSession(), { networkId: lead.id });
    expect(filtered.map((row) => row.id)).toContain(newer.id);
    expect(filtered.map((row) => row.id)).not.toContain(older.id);

    const first = await approveRegistration(adminSession(), {
      userId: older.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(first.ok).toBe(true);
    const second = await approveRegistration(adminSession(), {
      userId: older.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(second.ok).toBe(false);
  });

  it("Independent Test: approve/deny from oldest-first filterable queue; Moderator denied", async () => {
    const pathways = await networkByName("Pathways to Change");
    const lead = await networkByName("LEAD");
    const approveEmail = `approve-${randomUUID()}@example.com`;
    const denyEmail = `deny-${randomUUID()}@example.com`;
    const toApprove = await registerPending(approveEmail, pathways.id);
    const toDeny = await registerPending(denyEmail, lead.id);
    createdUserIds.push(toApprove.id, toDeny.id);
    const before = await mailBodies();

    await expect(
      listPendingRegistrations(claimsFor("moderator"), {
        clientAdminRole: "admin",
        clientMfaSatisfied: true,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(
      approveRegistration(claimsFor("moderator"), {
        userId: toApprove.id,
        ip: IP,
        userAgent: USER_AGENT,
        clientAdminRole: "admin",
        clientMfaSatisfied: true,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    const queue = await listPendingRegistrations(adminSession());
    expect(queue.map((row) => row.id).indexOf(toApprove.id)).toBeLessThan(
      queue.map((row) => row.id).indexOf(toDeny.id),
    );
    const pathwaysQueue = (
      await listPendingRegistrations(adminSession(), { networkId: pathways.id })
    ).map((row) => row.id);
    expect(pathwaysQueue).toContain(toApprove.id);
    expect(pathwaysQueue).not.toContain(toDeny.id);

    const approved = await approveRegistration(adminSession(), {
      userId: toApprove.id,
      networkId: lead.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(approved.ok).toBe(true);
    const denied = await denyRegistration(adminSession(), {
      userId: toDeny.id,
      reason: DENY_REASON,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(denied.ok).toBe(true);

    const approvedUser = await migrator.user.findUnique({ where: { id: toApprove.id } });
    expect(approvedUser?.status).toBe("active");
    expect(approvedUser?.programRole).toBe("lead");
    expect(approvedUser?.networkId).toBe(lead.id);

    const deniedUser = await migrator.user.findUnique({ where: { id: toDeny.id } });
    expect(deniedUser?.status).toBe("denied");
    expect(deniedUser).not.toBeNull();
    expect(decryptPii(deniedUser!.denialReasonEncrypted!)).toBe(DENY_REASON);

    const signedIn = await authorizeCredentials({
      email: approveEmail,
      password: PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(signedIn).not.toBeNull();
    expect(requireRole(await loadSession(signedIn!.sessionId)).status).toBe("active");
    expect(
      await authorizeCredentials({
        email: denyEmail,
        password: PASSWORD,
        ip: IP,
        userAgent: USER_AGENT,
      }),
    ).toBeNull();

    const after = await mailBodies();
    expect(countMatching(after, approveEmail, "You are in")).toBe(
      countMatching(before, approveEmail, "You are in") + 1,
    );
    expect(countMatching(after, denyEmail, "We are unable to approve this request at this time.")).toBe(
      countMatching(before, denyEmail, "We are unable to approve this request at this time.") + 1,
    );
    expect(after.join("\n")).not.toContain(DENY_REASON);

    const deniedAudit = await migrator.auditLog.findFirst({
      where: { action: "registration_denied", userAgent: USER_AGENT },
    });
    expect(deniedAudit?.metadata).toMatchObject({ has_reason: true });
    expect(JSON.stringify(deniedAudit?.metadata ?? {})).not.toContain(DENY_REASON);
  });
});
