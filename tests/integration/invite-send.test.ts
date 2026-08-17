import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { sendCsvInvites, sendManualInvite } from "@/lib/registration/invite";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-invite-send-${randomUUID()}`;

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

describe("invite send (US4 / FR-005 / FR-006)", () => {
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdInvitationIds.length > 0) {
      await migrator.invitation.deleteMany({ where: { id: { in: createdInvitationIds } } });
      createdInvitationIds.length = 0;
    }
  });

  it("sends a manual invite with a hashed token, 14-day expiry, and invitation_sent", async () => {
    const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
    if (!network) {
      throw new Error("Pathways network required");
    }
    const email = `manual-${randomUUID()}@example.com`;
    const before = await mailBodies();
    const sent = await sendManualInvite(adminSession(), {
      email,
      firstName: "Ada",
      lastName: "Lovelace",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    createdInvitationIds.push(sent.invitationId);
    expect(sent.token).toMatch(/^[0-9a-f]{64}$/);
    const row = await migrator.invitation.findUnique({ where: { id: sent.invitationId } });
    expect(row?.status).toBe("pending");
    expect(row?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 13 * 24 * 60 * 60 * 1000);
    const after = await mailBodies();
    const baseUrl = env().AUTH_URL ?? "http://127.0.0.1:3000";
    expect(countMatching(after, email, `${baseUrl}/invite/${sent.token}`)).toBe(
      countMatching(before, email, `${baseUrl}/invite/${sent.token}`) + 1,
    );
    const audit = await migrator.auditLog.findFirst({
      where: { action: "invitation_sent", userAgent: USER_AGENT },
    });
    expect(audit?.entityId).toBe(sent.invitationId);
    expect(JSON.stringify(audit?.metadata ?? {})).not.toContain(sent.token);
  });

  it("sends valid CSV rows, reports invalid rows, and writes bulk_invite_sent when two or more send", async () => {
    const emailA = `csv-a-${randomUUID()}@example.com`;
    const emailB = `csv-b-${randomUUID()}@example.com`;
    const result = await sendCsvInvites(adminSession(), {
      csvText: [
        "email,first_name,last_name,network_name,title,doc_affiliation",
        `${emailA},Ada,Lovelace,Pathways to Change,Analyst,Test Agency A`,
        `${emailB},Grace,Hopper,LEAD,Engineer,Test Agency A`,
        `pathways@local,Existing,Member,Pathways to Change,Analyst,Test Agency A`,
        `bad-${randomUUID()}@example.com,No,Network,Unknown Network,Analyst,Test Agency A`,
      ].join("\n"),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    createdInvitationIds.push(...result.sent.map((row) => row.invitationId));
    expect(result.sent).toHaveLength(2);
    expect(result.invalid.some((row) => row.reason === "email_already_a_user")).toBe(true);
    expect(result.invalid.some((row) => row.reason === "unknown_network")).toBe(true);
    const bulk = await migrator.auditLog.findFirst({
      where: { action: "bulk_invite_sent", userAgent: USER_AGENT },
    });
    expect(bulk?.metadata).toMatchObject({ count: 2 });
  });

  it("rejects a manual invite for an existing member or a pending invite", async () => {
    const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
    if (!network) {
      throw new Error("Pathways network required");
    }
    const existing = await sendManualInvite(adminSession(), {
      email: "pathways@local",
      firstName: "Path",
      lastName: "Ways",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(existing.ok).toBe(false);

    const email = `pending-invite-${randomUUID()}@example.com`;
    const first = await sendManualInvite(adminSession(), {
      email,
      firstName: "Once",
      lastName: "Only",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      createdInvitationIds.push(first.invitationId);
    }
    const second = await sendManualInvite(adminSession(), {
      email,
      firstName: "Twice",
      lastName: "No",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(second.ok).toBe(false);
    expect(
      await migrator.invitation.count({
        where: { emailLookup: hmacEmailLookup(email), status: "pending" },
      }),
    ).toBe(1);
  });
});
