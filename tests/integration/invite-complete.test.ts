import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import {
  INVITE_SIGNED_IN_COPY,
  INVITE_UNUSABLE_COPY,
  INVITE_USED_COPY,
  completeInvite,
  lookupInvite,
  sendCsvInvites,
  sendManualInvite,
} from "@/lib/registration/invite";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-invite-complete-${randomUUID()}`;
const PASSWORD = "invite-pass-12";

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

describe("invite complete (US4 / FR-008 / FR-009 / FR-023)", () => {
  const createdInvitationIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    if (createdInvitationIds.length > 0) {
      await migrator.invitation.deleteMany({ where: { id: { in: createdInvitationIds } } });
      createdInvitationIds.length = 0;
    }
  });

  it("completes an unused invite to an active member and refuses a second use", async () => {
    const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
    const affiliation = await migrator.docAffiliation.findFirst({
      where: { label: "Test Agency A", active: true },
    });
    if (!network || !affiliation) {
      throw new Error("fixtures required");
    }
    const email = `complete-${randomUUID()}@example.com`;
    const sent = await sendManualInvite(adminSession(), {
      email,
      firstName: "Complete",
      lastName: "Me",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    createdInvitationIds.push(sent.invitationId);

    const preview = await lookupInvite(sent.token);
    expect(preview.state).toBe("pending");
    if (preview.state === "pending") {
      expect(preview.email).toBe(email);
      expect(preview.firstName).toBe("Complete");
      expect(preview.networkName).toBe("Pathways to Change");
    }

    const completed = await completeInvite({
      token: sent.token,
      password: PASSWORD,
      title: "Analyst",
      docAffiliationId: affiliation.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(completed.ok).toBe(true);

    const user = await migrator.user.findUnique({ where: { emailLookup: hmacEmailLookup(email) } });
    expect(user?.status).toBe("active");
    expect(user?.programRole).toBe("pathways");
    expect(user?.adminRole).toBe("none");
    expect(user?.joinSource).toBe("invited");
    createdUserIds.push(user!.id);

    const signedIn = await authorizeCredentials({
      email,
      password: PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(signedIn).not.toBeNull();
    expect(requireRole(await loadSession(signedIn!.sessionId)).status).toBe("active");

    const reused = await completeInvite({
      token: sent.token,
      password: PASSWORD,
      title: "Analyst",
      docAffiliationId: affiliation.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(reused.ok).toBe(false);
    if (!reused.ok) {
      expect(reused.error).toBe(INVITE_USED_COPY);
    }
    expect((await lookupInvite(sent.token)).state).toBe("used");
  });

  it("treats expired-shaped and unknown tokens as the same unusable copy and refuses a signed-in session", async () => {
    const network = await migrator.network.findFirst({ where: { name: "LEAD" } });
    const affiliation = await migrator.docAffiliation.findFirst({
      where: { label: "Test Agency A", active: true },
    });
    if (!network || !affiliation) {
      throw new Error("fixtures required");
    }
    const email = `expired-${randomUUID()}@example.com`;
    const sent = await sendManualInvite(adminSession(), {
      email,
      firstName: "Expired",
      lastName: "Shape",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    createdInvitationIds.push(sent.invitationId);
    await migrator.invitation.update({
      where: { id: sent.invitationId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expired = await completeInvite({
      token: sent.token,
      password: PASSWORD,
      title: "Analyst",
      docAffiliationId: affiliation.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.error).toBe(INVITE_UNUSABLE_COPY);
    }

    const unknown = await completeInvite({
      token: "a".repeat(64),
      password: PASSWORD,
      title: "Analyst",
      docAffiliationId: affiliation.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error).toBe(INVITE_UNUSABLE_COPY);
    }

    const live = await sendManualInvite(adminSession(), {
      email: `signedin-${randomUUID()}@example.com`,
      firstName: "Stay",
      lastName: "Out",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(live.ok).toBe(true);
    if (!live.ok) {
      return;
    }
    createdInvitationIds.push(live.invitationId);
    const signedIn = await completeInvite({
      token: live.token,
      password: PASSWORD,
      title: "Analyst",
      docAffiliationId: affiliation.id,
      ip: IP,
      userAgent: USER_AGENT,
      signedIn: true,
    });
    expect(signedIn.ok).toBe(false);
    if (!signedIn.ok) {
      expect(signedIn.error).toBe(INVITE_SIGNED_IN_COPY);
    }
  });

  it("Independent Test: manual + mixed CSV; valid complete → active; second click used; Moderator denied", async () => {
    const affiliation = await migrator.docAffiliation.findFirst({
      where: { label: "Test Agency A", active: true },
    });
    if (!affiliation) {
      throw new Error("Test Agency A required");
    }
    const manualEmail = `indie-manual-${randomUUID()}@example.com`;
    const csvValid = `indie-csv-${randomUUID()}@example.com`;
    const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
    if (!network) {
      throw new Error("Pathways network required");
    }

    const manual = await sendManualInvite(adminSession(), {
      email: manualEmail,
      firstName: "Manual",
      lastName: "Invite",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(manual.ok).toBe(true);
    if (!manual.ok) {
      return;
    }
    createdInvitationIds.push(manual.invitationId);

    const csv = await sendCsvInvites(adminSession(), {
      csvText: [
        "email,first_name,last_name,network_name,title,doc_affiliation",
        `${csvValid},Csv,Valid,LEAD,Engineer,Test Agency A`,
        `skip-${randomUUID()}@example.com,Bad,Doc,Pathways to Change,Engineer,Test Agency Inactive`,
      ].join("\n"),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(csv.ok).toBe(true);
    if (!csv.ok) {
      return;
    }
    createdInvitationIds.push(...csv.sent.map((row) => row.invitationId));
    expect(csv.sent).toHaveLength(1);
    expect(csv.invalid.some((row) => row.reason === "inactive_or_unknown_doc")).toBe(true);

    await expect(
      sendManualInvite(claimsFor("moderator"), {
        email: `mod-${randomUUID()}@example.com`,
        firstName: "No",
        lastName: "Access",
        networkId: network.id,
        ip: IP,
        userAgent: USER_AGENT,
        clientAdminRole: "admin",
        clientMfaSatisfied: true,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    const csvToken = csv.sent[0]?.token;
    expect(csvToken).toBeTruthy();
    const completed = await completeInvite({
      token: csvToken!,
      password: PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(completed.ok).toBe(true);
    const user = await migrator.user.findUnique({ where: { emailLookup: hmacEmailLookup(csvValid) } });
    expect(user?.status).toBe("active");
    expect(user?.programRole).toBe("lead");
    expect(user?.joinSource).toBe("invited");
    createdUserIds.push(user!.id);

    const second = await completeInvite({
      token: csvToken!,
      password: PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toBe(INVITE_USED_COPY);
    }
  });
});
