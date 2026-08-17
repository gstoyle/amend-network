import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { decryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { listVisibleRecords } from "@/lib/db/visibility";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { registrationVisitorCopy, registerSelf } from "@/lib/registration/register";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-register-${randomUUID()}`;
const PASSWORD = "register-pass-12";

async function mailEntries(): Promise<{ name: string; body: string }[]> {
  const dir = env().EMAIL_JSON_DIR ?? ".tmp/mail";
  try {
    const names = await readdir(dir);
    return Promise.all(
      names.map(async (name) => ({ name, body: await readFile(join(dir, name), "utf8") })),
    );
  } catch {
    return [];
  }
}

async function mailBodies(): Promise<string[]> {
  return (await mailEntries()).map((entry) => entry.body);
}

function countMatching(bodies: string[], ...needles: string[]): number {
  return bodies.filter((body) => needles.every((needle) => body.includes(needle))).length;
}

async function launchNetwork() {
  const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
  if (!network) {
    throw new Error("Pathways network required");
  }
  return network;
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

async function inactiveAffiliation() {
  const row = await migrator.docAffiliation.findFirst({
    where: { label: "Test Agency Inactive" },
  });
  if (!row) {
    throw new Error("Test Agency Inactive required");
  }
  return row;
}

describe("self-registration (US2 / FR-001–FR-004)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("creates a pending user for a new email and rejects inactive DOC and short passwords", async () => {
    const network = await launchNetwork();
    const active = await activeAffiliation();
    const inactive = await inactiveAffiliation();
    const email = `new-${randomUUID()}@example.com`;

    const invalidDoc = await registerSelf({
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Analyst",
      email,
      password: PASSWORD,
      docAffiliationId: inactive.id,
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(invalidDoc.ok).toBe(false);
    expect(await migrator.user.findUnique({ where: { emailLookup: hmacEmailLookup(email) } })).toBeNull();

    const shortPassword = await registerSelf({
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Analyst",
      email,
      password: "short",
      docAffiliationId: active.id,
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(shortPassword.ok).toBe(false);

    const created = await registerSelf({
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Analyst",
      email,
      password: PASSWORD,
      docAffiliationId: active.id,
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.message).toBe(registrationVisitorCopy("created"));
    }

    const user = await migrator.user.findUnique({ where: { emailLookup: hmacEmailLookup(email) } });
    expect(user).not.toBeNull();
    createdUserIds.push(user!.id);
    expect(user?.status).toBe("pending");
    expect(user?.programRole).toBe("none");
    expect(user?.adminRole).toBe("none");
    expect(user?.joinSource).toBe("self_registered");
    expect(user?.networkId).toBe(network.id);
    expect(decryptPii(user!.firstNameEncrypted!)).toBe("Ada");
    expect(decryptPii(user!.titleEncrypted!)).toBe("Analyst");
    expect(decryptPii(user!.docAffiliationIdEncrypted!)).toBe(active.id);

    const audit = await migrator.auditLog.findFirst({
      where: { action: "registration_submitted", userAgent: USER_AGENT },
    });
    expect(audit?.actorUserId).toBe(user!.id);
    expect(JSON.stringify(audit?.metadata ?? {}).toLowerCase()).not.toContain("doc");
  });

  it("returns the same generic copy for active, pending, denied, and deactivated emails and does not send another confirmation", async () => {
    const network = await launchNetwork();
    const active = await activeAffiliation();
    const before = await mailBodies();
    const input = {
      firstName: "Dup",
      lastName: "User",
      title: "Role",
      password: PASSWORD,
      docAffiliationId: active.id,
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    };

    const results = [];
    for (const email of ["pathways@local", "pending@local", "denied@local", "deactivated@local"]) {
      const result = await registerSelf({ ...input, email });
      expect(result.ok).toBe(true);
      if (result.ok) {
        results.push(result.message);
      }
    }
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(registrationVisitorCopy("duplicate"));

    const after = await mailBodies();
    expect(countMatching(after, "pathways@local", "We received your request")).toBe(
      countMatching(before, "pathways@local", "We received your request"),
    );
  });

  it("Independent Test: new email → pending + two json mails + holding page; pathways@local → same generic copy, no extra confirmation", async () => {
    const network = await launchNetwork();
    const active = await activeAffiliation();
    const email = `indie-${randomUUID()}@example.com`;
    const beforeNames = new Set((await mailEntries()).map((entry) => entry.name));

    const created = await registerSelf({
      firstName: "Indie",
      lastName: "Test",
      title: "Member",
      email,
      password: PASSWORD,
      docAffiliationId: active.id,
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.message).toBe(registrationVisitorCopy("created"));
    }

    const user = await migrator.user.findUnique({ where: { emailLookup: hmacEmailLookup(email) } });
    expect(user?.status).toBe("pending");
    createdUserIds.push(user!.id);

    const afterCreate = await mailEntries();
    const newBodies = afterCreate
      .filter((entry) => !beforeNames.has(entry.name))
      .map((entry) => entry.body);
    expect(countMatching(newBodies, email, "We received your request")).toBe(1);
    expect(
      countMatching(newBodies, env().ADMIN_ALERT_EMAIL ?? "admins@example.com", "New pending registration"),
    ).toBeGreaterThanOrEqual(1);
    expect(newBodies.filter((body) => body.includes(email)).join("\n").toLowerCase()).not.toContain(
      "test agency a",
    );

    const signedIn = await authorizeCredentials({
      email,
      password: PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(signedIn).not.toBeNull();
    const claims = await loadSession(signedIn!.sessionId);
    expect(isPendingSession(claims)).toBe(true);
    expect(() => requireRole(claims)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(requireRole(claims, { statuses: ["pending"] }).status).toBe("pending");
    expect(await listVisibleRecords(requireRole(claims, { statuses: ["pending"] }))).toHaveLength(0);

    const duplicate = await registerSelf({
      firstName: "Path",
      lastName: "Ways",
      title: "Member",
      email: "pathways@local",
      password: PASSWORD,
      docAffiliationId: active.id,
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) {
      expect(duplicate.message).toBe(created.ok ? created.message : "");
    }
    const afterDuplicate = await mailBodies();
    expect(countMatching(afterDuplicate, "pathways@local", "We received your request")).toBe(
      countMatching(
        afterCreate.map((entry) => entry.body),
        "pathways@local",
        "We received your request",
      ),
    );
  });
});
