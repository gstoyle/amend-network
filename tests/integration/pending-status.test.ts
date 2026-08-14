import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listVisibleRecords } from "@/lib/db/visibility";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";

const IP = "127.0.0.1";
const USER_AGENT = `vitest-pending-${randomUUID()}`;

describe("pending holding vs silent denial (US8 / FR-015 / FR-016)", () => {
  afterEach(async () => {
    await migrator.session.deleteMany({ where: { userAgent: USER_AGENT } });
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
  });

  it("Independent Test: pending reaches holding with 0 fixtures; denied/deactivated share generic failure", async () => {
    const pending = await authorizeCredentials({
      email: "pending@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(pending).not.toBeNull();
    const claims = await loadSession(pending!.sessionId);
    expect(isPendingSession(claims)).toBe(true);
    expect(() => requireRole(claims)).toThrowError(AUTH_FAILURE_MESSAGE);
    const holding = requireRole(claims, { statuses: ["pending"] });
    expect(holding.status).toBe("pending");
    const rows = await listVisibleRecords(holding);
    expect(rows).toHaveLength(0);

    const denied = await authorizeCredentials({
      email: "denied@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(denied).toBeNull();

    const deactivated = await authorizeCredentials({
      email: "deactivated@local",
      password: env().SEED_PASSWORD,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(deactivated).toBeNull();
  });
});
