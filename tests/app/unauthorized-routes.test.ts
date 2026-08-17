import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import type { AdminRole } from "@/lib/auth/types";
import { listPendingRegistrations } from "@/lib/registration/approve";
import { addDocAffiliation } from "@/lib/registration/doc-affiliations";
import { sendManualInvite } from "@/lib/registration/invite";
import { listAdminAnnouncements, createAnnouncement } from "@/lib/announcements/publish";
import { listAdminResources, mintIngestSlots } from "@/lib/resources/publish";
import { claimsFor } from "@/tests/helpers/prd-matrix";

function authorizedFor(pathname: string, sessionId?: string): boolean {
  const callback = authConfig.callbacks?.authorized;
  if (!callback) {
    throw new Error("authorized callback missing");
  }
  const result = callback({
    auth: sessionId ? { sessionId } : null,
    request: { nextUrl: { pathname } },
  } as never);
  return result === true;
}

describe("unauthorized roles are denied on delivered handlers (FR-026)", () => {
  it("member and admin routes reject a missing session at layer 1", () => {
    expect(authorizedFor("/app")).toBe(false);
    expect(authorizedFor("/app/anything")).toBe(false);
    expect(authorizedFor("/admin")).toBe(false);
    expect(authorizedFor("/login")).toBe(true);
  });

  it("member home requireRole denies anonymous, pending, and denied sessions", () => {
    expect(() => requireRole(null)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);
    const denied = claimsFor("pathways")!;
    expect(() => requireRole({ ...denied, status: "denied" })).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("admin-only requireRole denies Pathways and LEAD members", () => {
    expect(() =>
      requireRole(claimsFor("pathways"), { admin: ["admin", "super_admin"] }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() =>
      requireRole(claimsFor("lead"), { admin: ["admin", "super_admin"] }),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(requireRole(claimsFor("admin"), { admin: ["admin", "super_admin"] }).adminRole).toBe(
      "admin",
    );
  });

  it("program-scoped requireRole denies the other program", () => {
    expect(() => requireRole(claimsFor("pathways"), { program: "lead" })).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), { program: "pathways" })).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("audit-log read denies members, moderator, and admin without mfa_satisfied", () => {
    expect(authorizedFor("/admin/audit-log")).toBe(false);
    expect(authorizedFor("/admin/audit-log", "session-id")).toBe(true);

    const auditRead = { admin: ["super_admin", "admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("pathways"), auditRead)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), auditRead)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("moderator"), auditRead)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("admin"), auditRead)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(
      requireRole(
        { ...claimsFor("admin")!, mfaSatisfied: true },
        auditRead,
      ).adminRole,
    ).toBe("admin");
  });

  it("affiliations management denies Moderator, Pathways, LEAD, and Pending (FR-021)", async () => {
    expect(authorizedFor("/admin/users/affiliations")).toBe(false);
    expect(authorizedFor("/admin/users/affiliations", "session-id")).toBe(true);

    const affiliations = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), affiliations)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), affiliations)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), affiliations)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pending"), affiliations)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, affiliations).adminRole,
    ).toBe("admin");

    const input = {
      label: "unauthorized-should-not-insert",
      ip: "127.0.0.1",
      userAgent: "vitest-affiliations-deny",
      clientAdminRole: "admin" as const,
      clientMfaSatisfied: true,
    };
    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(addDocAffiliation(claimsFor(role), input)).rejects.toThrowError(
        AUTH_FAILURE_MESSAGE,
      );
    }
  });

  it("pending queue denies Moderator, Pathways, LEAD, and Pending (FR-021)", async () => {
    expect(authorizedFor("/admin/users/pending")).toBe(false);
    expect(authorizedFor("/admin/users/pending", "session-id")).toBe(true);

    const pendingQueue = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), pendingQueue)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), pendingQueue)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), pendingQueue)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pending"), pendingQueue)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, pendingQueue).adminRole,
    ).toBe("admin");

    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(
        listPendingRegistrations(claimsFor(role), {
          clientAdminRole: "admin",
          clientMfaSatisfied: true,
        }),
      ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    }
  });

  it("invite send denies Moderator, Pathways, LEAD, and Pending (FR-021)", async () => {
    expect(authorizedFor("/admin/users/invite")).toBe(false);
    expect(authorizedFor("/admin/users/invite", "session-id")).toBe(true);

    const inviteAccess = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), inviteAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), inviteAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), inviteAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pending"), inviteAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, inviteAccess).adminRole,
    ).toBe("admin");

    const input = {
      email: "unauthorized-invite@example.com",
      firstName: "No",
      lastName: "Access",
      networkId: "00000000-0000-4000-8000-000000000099",
      ip: "127.0.0.1",
      userAgent: "vitest-invite-deny",
      clientAdminRole: "admin" as const,
      clientMfaSatisfied: true,
    };
    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(sendManualInvite(claimsFor(role), input)).rejects.toThrowError(
        AUTH_FAILURE_MESSAGE,
      );
    }
  });

  it("admin resources denies Moderator, Pathways, LEAD, and Pending (US1)", async () => {
    expect(authorizedFor("/admin/resources")).toBe(false);
    expect(authorizedFor("/admin/resources/new")).toBe(false);
    expect(authorizedFor("/admin/resources/any-id")).toBe(false);
    expect(authorizedFor("/admin/resources", "session-id")).toBe(true);
    expect(authorizedFor("/admin/resources/new", "session-id")).toBe(true);
    expect(authorizedFor("/admin/resources/any-id", "session-id")).toBe(true);

    const resourcesAccess = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), resourcesAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), resourcesAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), resourcesAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pending"), resourcesAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("admin"), resourcesAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, resourcesAccess).adminRole,
    ).toBe("admin");

    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(mintIngestSlots(claimsFor(role))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
      await expect(listAdminResources(claimsFor(role))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    }
  });

  it("admin announcements denies Moderator, Pathways, LEAD, and Pending (US1)", async () => {
    expect(authorizedFor("/admin/announcements")).toBe(false);
    expect(authorizedFor("/admin/announcements/new")).toBe(false);
    expect(authorizedFor("/admin/announcements/any-id")).toBe(false);
    expect(authorizedFor("/admin/announcements", "session-id")).toBe(true);
    expect(authorizedFor("/admin/announcements/new", "session-id")).toBe(true);
    expect(authorizedFor("/admin/announcements/any-id", "session-id")).toBe(true);

    const announcementsAccess = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), announcementsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), announcementsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), announcementsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pending"), announcementsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("admin"), announcementsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, announcementsAccess).adminRole,
    ).toBe("admin");

    const createInput = {
      headline: "unauthorized",
      body: "body",
      visibility: ["all_authenticated"],
      activatesAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ip: "127.0.0.1",
      userAgent: "vitest-announcement-deny",
    };
    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(createAnnouncement(claimsFor(role), createInput)).rejects.toThrowError(
        AUTH_FAILURE_MESSAGE,
      );
      await expect(listAdminAnnouncements(claimsFor(role))).rejects.toThrowError(
        AUTH_FAILURE_MESSAGE,
      );
    }
  });

  it("member resource library denies a missing session at layer 1 (US2)", () => {
    expect(authorizedFor("/app/resources")).toBe(false);
    expect(authorizedFor("/app/resources/any-id")).toBe(false);
    expect(authorizedFor("/app/resources/any-id/thumbnail")).toBe(false);
    expect(authorizedFor("/app/resources/any-id/download")).toBe(false);
    expect(authorizedFor("/app/resources/any-id/file")).toBe(false);
    expect(authorizedFor("/app/resources", "session-id")).toBe(true);
    expect(() => requireRole(null)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);
  });
});
