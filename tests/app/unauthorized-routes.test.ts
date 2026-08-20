import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import type { AdminRole } from "@/lib/auth/types";
import { listPendingRegistrations } from "@/lib/registration/approve";
import { addDocAffiliation } from "@/lib/registration/doc-affiliations";
import { sendManualInvite } from "@/lib/registration/invite";
import { listAdminAnnouncements, createAnnouncement } from "@/lib/announcements/publish";
import { cancelEvent } from "@/lib/events/cancel";
import { updateEvent } from "@/lib/events/edit";
import { createEvent, listAdminEvents } from "@/lib/events/publish";
import { setEventRsvp } from "@/lib/events/rsvp";
import { saveDirectoryPrivacy } from "@/lib/directory/privacy";
import { listDirectory } from "@/lib/directory/list";
import { getDirectoryProfile } from "@/lib/directory/profile";
import { listAdminResources, mintIngestSlots } from "@/lib/resources/publish";
import { loadAdminAnalytics } from "@/lib/admin-analytics/load";
import { exportAuditLog } from "@/lib/audit/export";
import { listAuditLog } from "@/lib/audit/read";
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

  it("audit-log read denies members, moderator, pending, and signed-out", async () => {
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
    expect(() => requireRole(claimsFor("pending"), auditRead)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("invited"), auditRead)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(null, auditRead)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(requireRole(claimsFor("admin"), auditRead).adminRole).toBe("admin");
    expect(
      requireRole(
        { ...claimsFor("admin")!, mfaSatisfied: true },
        auditRead,
      ).adminRole,
    ).toBe("admin");

    await expect(listAuditLog(null)).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(listAuditLog(claimsFor("pathways"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(listAuditLog(claimsFor("lead"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(listAuditLog(claimsFor("moderator"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(listAuditLog(claimsFor("pending"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(
      listAuditLog(claimsFor("pathways"), { clientAdminRole: "super_admin", clientMfaSatisfied: true }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("audit-log export denies Admin, Moderator, members, pending, and signed-out (no file, no audit_log_exported)", async () => {
    expect(authorizedFor("/admin/audit-log/export")).toBe(false);
    expect(authorizedFor("/admin/audit-log/export", "session-id")).toBe(true);

    const exportAccess = { admin: ["super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("admin"), exportAccess)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() =>
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, exportAccess),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("moderator"), exportAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), exportAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), exportAccess)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"), exportAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(null, exportAccess)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(requireRole(claimsFor("super_admin"), exportAccess).adminRole).toBe("super_admin");

    await expect(exportAuditLog(null)).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(exportAuditLog(claimsFor("admin"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(
      exportAuditLog({ ...claimsFor("admin")!, mfaSatisfied: true }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(exportAuditLog(claimsFor("moderator"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(exportAuditLog(claimsFor("pathways"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(exportAuditLog(claimsFor("lead"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(exportAuditLog(claimsFor("pending"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(
      exportAuditLog({ ...claimsFor("admin")!, mfaSatisfied: true }, { clientAdminRole: "super_admin" }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("analytics denies Moderator, Pathways, LEAD, pending, and signed-out (US1)", async () => {
    expect(authorizedFor("/admin/analytics")).toBe(false);
    expect(authorizedFor("/admin/analytics", "session-id")).toBe(true);

    const analyticsAccess = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(() => requireRole(claimsFor("moderator"), analyticsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pathways"), analyticsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("lead"), analyticsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(claimsFor("pending"), analyticsAccess)).toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    expect(() => requireRole(null, analyticsAccess)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(requireRole(claimsFor("admin"), analyticsAccess).adminRole).toBe("admin");
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, analyticsAccess).adminRole,
    ).toBe("admin");

    await expect(loadAdminAnalytics(null, null)).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(loadAdminAnalytics(claimsFor("moderator"), null)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(loadAdminAnalytics(claimsFor("pathways"), null)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(loadAdminAnalytics(claimsFor("lead"), null)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(loadAdminAnalytics(claimsFor("pending"), null)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(
      loadAdminAnalytics(claimsFor("pathways"), null, { clientAdminRole: "super_admin" }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
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
    expect(requireRole(claimsFor("admin"), resourcesAccess).adminRole).toBe("admin");
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
    expect(requireRole(claimsFor("admin"), announcementsAccess).adminRole).toBe("admin");
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

  it("admin events denies Pathways, LEAD, and Pending; Moderator is allowed (unlike announcements)", async () => {
    expect(authorizedFor("/admin/events")).toBe(false);
    expect(authorizedFor("/admin/events/new")).toBe(false);
    expect(authorizedFor("/admin/events/any-id")).toBe(false);
    expect(authorizedFor("/admin/events", "session-id")).toBe(true);
    expect(authorizedFor("/admin/events/new", "session-id")).toBe(true);
    expect(authorizedFor("/admin/events/any-id", "session-id")).toBe(true);

    const eventsAccess = {
      admin: ["admin", "super_admin", "moderator"] satisfies AdminRole[],
      mfa: true,
    };
    const announcementsAccess = { admin: ["admin", "super_admin"] satisfies AdminRole[], mfa: true };
    expect(eventsAccess.admin).not.toEqual(announcementsAccess.admin);

    expect(() => requireRole(claimsFor("pathways"), eventsAccess)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("lead"), eventsAccess)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"), eventsAccess)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(requireRole(claimsFor("admin"), eventsAccess).adminRole).toBe("admin");
    expect(
      requireRole({ ...claimsFor("admin")!, mfaSatisfied: true }, eventsAccess).adminRole,
    ).toBe("admin");
    expect(
      requireRole({ ...claimsFor("moderator")!, mfaSatisfied: true }, eventsAccess).adminRole,
    ).toBe("moderator");
    expect(() =>
      requireRole({ ...claimsFor("moderator")!, mfaSatisfied: true }, announcementsAccess),
    ).toThrowError(AUTH_FAILURE_MESSAGE);

    const createInput = {
      title: "unauthorized-should-not-insert",
      description: "body",
      visibility: ["all_authenticated"],
      startsAt: new Date(Date.now() + 60_000),
      endsAt: new Date(Date.now() + 120_000),
      ip: "127.0.0.1",
      userAgent: "vitest-event-deny",
    };
    for (const role of ["pathways", "lead", "pending"] as const) {
      await expect(createEvent(claimsFor(role), createInput)).rejects.toThrowError(
        AUTH_FAILURE_MESSAGE,
      );
      await expect(listAdminEvents(claimsFor(role))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
      await expect(updateEvent(claimsFor(role), "00000000-0000-4000-8000-000000000099", createInput)).rejects.toThrowError(
        AUTH_FAILURE_MESSAGE,
      );
      await expect(
        cancelEvent(claimsFor(role), "00000000-0000-4000-8000-000000000099", {
          ip: "127.0.0.1",
          userAgent: "vitest-event-deny",
        }),
      ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    }
    await expect(listAdminEvents(claimsFor("moderator"))).resolves.toEqual(expect.any(Array));
  });

  it("member event RSVP denies missing session, pending, and other-cohort events (US3)", async () => {
    expect(authorizedFor("/app/events/any-id/rsvp")).toBe(false);
    expect(authorizedFor("/app/events/any-id/rsvp", "session-id")).toBe(true);
    expect(() => requireRole(null)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);

    const ctx = { ip: "127.0.0.1", userAgent: "vitest-rsvp-deny" };
    await expect(setEventRsvp(null, "00000000-0000-4000-8000-000000000099", "yes", ctx)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(
      setEventRsvp(claimsFor("pending"), "00000000-0000-4000-8000-000000000099", "yes", ctx),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
  });

  it("directory privacy denies pending, invited, and signed-out (US1)", async () => {
    expect(authorizedFor("/app/profile/privacy")).toBe(false);
    expect(authorizedFor("/app/profile/privacy", "session-id")).toBe(true);
    expect(() => requireRole(null)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("invited"))).toThrowError(AUTH_FAILURE_MESSAGE);

    const input = {
      listing: true,
      showTitle: false,
      showDocAffiliation: false,
      showEmail: false,
    };
    const ctx = { ip: "127.0.0.1", userAgent: "vitest-privacy-deny" };
    await expect(saveDirectoryPrivacy(null, input, ctx)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(saveDirectoryPrivacy(claimsFor("pending"), input, ctx)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(saveDirectoryPrivacy(claimsFor("invited"), input, ctx)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("directory list denies pending, invited, and signed-out (US2)", async () => {
    expect(authorizedFor("/app/directory")).toBe(false);
    expect(authorizedFor("/app/directory", "session-id")).toBe(true);
    expect(() => requireRole(null)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);

    await expect(listDirectory(null, { q: "" })).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(listDirectory(claimsFor("pending"), { q: "" })).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(listDirectory(claimsFor("invited"), { q: "" })).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("directory profile denies pending, invited, and signed-out; withholds unknown ids (US3)", async () => {
    expect(authorizedFor("/app/directory/any-id")).toBe(false);
    expect(authorizedFor("/app/directory/any-id", "session-id")).toBe(true);
    expect(() => requireRole(null)).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);

    const unknownId = "00000000-0000-4000-8000-000000000099";
    const ctx = { ip: "127.0.0.1", userAgent: "vitest-directory-profile-deny" };
    await expect(getDirectoryProfile(null, unknownId, ctx)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(getDirectoryProfile(claimsFor("pending"), unknownId, ctx)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
    await expect(getDirectoryProfile(claimsFor("invited"), unknownId, ctx)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );

    const withheld = await getDirectoryProfile(claimsFor("pathways"), unknownId, ctx);
    expect(withheld).toBeNull();
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
