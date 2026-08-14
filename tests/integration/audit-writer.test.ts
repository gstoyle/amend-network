import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { writeAudit } from "@/lib/audit/write";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { prisma } from "@/lib/db/prisma";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { env } from "@/lib/env";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-audit-writer-${randomUUID()}`;

async function latestByAction(action: string) {
  return migrator.auditLog.findFirst({
    where: { action, userAgent: USER_AGENT },
    orderBy: { createdAt: "desc" },
  });
}

describe("audit writer is append-only and same-transaction (US4 / FR-018)", () => {
  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
  });

  it("writes login_success and login_failure rows for seed sign-in", async () => {
    const ok = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(ok).not.toBeNull();
    const success = await latestByAction("login_success");
    expect(success?.actorUserId).toBe(ok!.userId);
    expect(success?.severity).toBe("info");

    const denied = await authorizeCredentials({
      email: "pathways@local",
      password: "wrong-password-12",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(denied).toBeNull();
    const failure = await latestByAction("login_failure");
    expect(failure?.severity).toBe("warning");
  });

  it("rolls back the audit row when the surrounding transaction fails", async () => {
    try {
      await withRls({}, async (tx) => {
        await writeAudit(tx, {
          actorRole: "anonymous",
          action: "login_failure",
          ip: IP,
          userAgent: USER_AGENT,
          severity: "warning",
        });
        throw new Error("force-rollback");
      });
    } catch (error) {
      expect((error as Error).message).toBe("force-rollback");
    }

    const row = await migrator.auditLog.findFirst({
      where: { userAgent: USER_AGENT, action: "login_failure" },
    });
    expect(row).toBeNull();
  });

  it("Independent Test: sign-in writes rows; UPDATE/DELETE as amend_app fail", async () => {
    const ok = await authorizeCredentials({
      email: "pathways@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(ok).not.toBeNull();
    expect((await latestByAction("login_success"))?.actorUserId).toBe(ok!.userId);

    expect(
      await authorizeCredentials({
        email: "nobody@local",
        password: env().SEED_PASSWORD,
        ip: IP,
        userAgent: USER_AGENT,
      }),
    ).toBeNull();
    expect((await latestByAction("login_failure"))?.severity).toBe("warning");

    const created = await migrator.auditLog.create({
      data: {
        actorRole: "none",
        action: "login_success",
        ip: IP,
        userAgent: USER_AGENT,
        severity: "info",
      },
    });
    await expect(
      prisma.auditLog.update({
        where: { id: created.id },
        data: { action: "logout" },
      }),
    ).rejects.toThrow();
    await expect(prisma.auditLog.delete({ where: { id: created.id } })).rejects.toThrow();
    expect((await migrator.auditLog.findUnique({ where: { id: created.id } }))?.action).toBe(
      "login_success",
    );
  });
});
