import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import {
  INVITE_UNUSABLE_COPY,
  completeInvite,
  listInvitations,
  lookupInvite,
  reissueInvite,
  revokeInvite,
  sendManualInvite,
} from "@/lib/registration/invite";
import { runInvitationSweep } from "@/lib/registration/sweep";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-invite-lifecycle-${randomUUID()}`;
const PASSWORD = "invite-pass-12";
const DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_EMAIL = "admin@local";

async function adminSession() {
  const user = await migrator.user.findFirst({
    where: { emailLookup: hmacEmailLookup(ADMIN_EMAIL) },
  });
  if (!user) {
    throw new Error("admin@local required");
  }
  return {
    ...claimsFor("admin")!,
    userId: user.id,
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

describe("invite lifecycle (US5 / FR-016)", () => {
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdInvitationIds.length > 0) {
      await migrator.invitation.deleteMany({ where: { id: { in: createdInvitationIds } } });
      createdInvitationIds.length = 0;
    }
  });

  it("Independent Test: frozen-clock expiry, T-3d reminder, revoke, re-issue", async () => {
    const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
    if (!network) {
      throw new Error("Pathways network required");
    }
    const session = await adminSession();

    const remindEmail = `life-remind-${randomUUID()}@example.com`;
    const expireEmail = `life-expire-${randomUUID()}@example.com`;
    const revokeEmail = `life-revoke-${randomUUID()}@example.com`;

    const remind = await sendManualInvite(session, {
      email: remindEmail,
      firstName: "Remind",
      lastName: "Me",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    const expire = await sendManualInvite(session, {
      email: expireEmail,
      firstName: "Expire",
      lastName: "Me",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    const revoke = await sendManualInvite(session, {
      email: revokeEmail,
      firstName: "Revoke",
      lastName: "Me",
      networkId: network.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(remind.ok && expire.ok && revoke.ok).toBe(true);
    if (!remind.ok || !expire.ok || !revoke.ok) {
      return;
    }
    createdInvitationIds.push(remind.invitationId, expire.invitationId, revoke.invitationId);

    const listed = await listInvitations(session);
    expect(listed.some((row) => row.id === remind.invitationId && row.status === "pending")).toBe(true);

    const now = new Date();
    await migrator.invitation.update({
      where: { id: remind.invitationId },
      data: { expiresAt: new Date(now.getTime() + 3 * DAY_MS) },
    });

    const beforeRemind = await mailBodies();
    await runInvitationSweep(now);
    const afterRemind = await mailBodies();
    expect(countMatching(afterRemind, remindEmail, "3 days")).toBe(
      countMatching(beforeRemind, remindEmail, "3 days") + 1,
    );
    expect(countMatching(afterRemind, ADMIN_EMAIL, "3 days")).toBe(
      countMatching(beforeRemind, ADMIN_EMAIL, "3 days") + 1,
    );
    const reminded = await migrator.invitation.findUnique({ where: { id: remind.invitationId } });
    expect(reminded?.status).toBe("pending");
    expect(reminded?.expiryReminderSentAt).not.toBeNull();
    expect((await migrator.invitation.findUnique({ where: { id: expire.invitationId } }))?.status).toBe(
      "pending",
    );

    await runInvitationSweep(now);
    const afterRemindAgain = await mailBodies();
    expect(countMatching(afterRemindAgain, remindEmail, "3 days")).toBe(
      countMatching(afterRemind, remindEmail, "3 days"),
    );

    await migrator.invitation.update({
      where: { id: expire.invitationId },
      data: { expiresAt: new Date(now.getTime() - 1000) },
    });
    const beforeExpire = await mailBodies();
    await runInvitationSweep(now);
    expect((await migrator.invitation.findUnique({ where: { id: expire.invitationId } }))?.status).toBe(
      "expired",
    );
    const expiredAudit = await migrator.auditLog.findFirst({
      where: { action: "invitation_expired", entityId: expire.invitationId },
    });
    expect(expiredAudit?.actorRole).toBe("system");
    const afterExpire = await mailBodies();
    expect(countMatching(afterExpire, ADMIN_EMAIL, "expired unused")).toBeGreaterThan(
      countMatching(beforeExpire, ADMIN_EMAIL, "expired unused"),
    );
    expect(countMatching(afterExpire, expireEmail, "expired unused")).toBe(
      countMatching(beforeExpire, expireEmail, "expired unused"),
    );
    const expiredComplete = await completeInvite({
      token: expire.token,
      password: PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(expiredComplete.ok).toBe(false);
    if (!expiredComplete.ok) {
      expect(expiredComplete.error).toBe(INVITE_UNUSABLE_COPY);
    }

    const revoked = await revokeInvite(session, {
      invitationId: revoke.invitationId,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(revoked.ok).toBe(true);
    expect((await migrator.invitation.findUnique({ where: { id: revoke.invitationId } }))?.status).toBe(
      "revoked",
    );
    const revokeAudit = await migrator.auditLog.findFirst({
      where: { action: "invitation_revoked", userAgent: USER_AGENT, entityId: revoke.invitationId },
    });
    expect(revokeAudit).not.toBeNull();
    const revokedComplete = await completeInvite({
      token: revoke.token,
      password: PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(revokedComplete.ok).toBe(false);
    if (!revokedComplete.ok) {
      expect(revokedComplete.error).toBe(INVITE_UNUSABLE_COPY);
    }

    await expect(
      revokeInvite(claimsFor("moderator"), {
        invitationId: remind.invitationId,
        ip: IP,
        userAgent: USER_AGENT,
        clientAdminRole: "admin",
        clientMfaSatisfied: true,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    const reissued = await reissueInvite(session, {
      invitationId: expire.invitationId,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(reissued.ok).toBe(true);
    if (!reissued.ok) {
      return;
    }
    createdInvitationIds.push(reissued.invitationId);
    expect(reissued.invitationId).not.toBe(expire.invitationId);
    expect(reissued.token).not.toBe(expire.token);
    expect((await lookupInvite(reissued.token)).state).toBe("pending");
    expect((await lookupInvite(expire.token)).state).toBe("unusable");
    const sentAudit = await migrator.auditLog.findFirst({
      where: { action: "invitation_sent", userAgent: USER_AGENT, entityId: reissued.invitationId },
    });
    expect(sentAudit).not.toBeNull();
    expect((await migrator.invitation.findUnique({ where: { id: expire.invitationId } }))?.status).toBe(
      "expired",
    );
  });
});
