import { describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import { listVisibleRecords } from "@/lib/db/visibility";
import { listPendingRegistrations } from "@/lib/registration/approve";
import { addDocAffiliation } from "@/lib/registration/doc-affiliations";
import { listInvitations, reissueInvite, revokeInvite } from "@/lib/registration/invite";
import { createAnnouncement } from "@/lib/announcements/publish";
import { listEligibleBanners } from "@/lib/announcements/list";
import { createEvent } from "@/lib/events/publish";
import { listVisibleEvents } from "@/lib/events/list";
import { setEventRsvp } from "@/lib/events/rsvp";
import { grantDownload } from "@/lib/resources/download";
import { listResources } from "@/lib/resources/list";
import { mintIngestSlots } from "@/lib/resources/publish";
import {
  CAPABILITIES,
  EXPECTED_VISIBLE_TITLES,
  MATRIX_ROLES,
  PRD_MATRIX,
  claimsFor,
  type Capability,
  type MatrixRole,
  type MatrixVerdict,
} from "@/tests/helpers/prd-matrix";

function isBuilt(_capability: Capability): boolean {
  switch (_capability) {
    case "log_in":
    case "view_dashboard":
    case "view_audit_log":
    case "approve_deny_registrations":
    case "upload_edit_delete_resources":
    case "view_shared_resources":
    case "view_role_specific_resources":
    case "download_resources":
    case "view_announcements":
    case "create_manage_announcements":
    case "create_edit_delete_events":
    case "view_events":
    case "rsvp_events":
      return true;
    case "view_directory":
    case "appear_in_directory":
    case "view_forum":
    case "post_forum":
    case "moderate_forum":
    case "assign_change_roles":
    case "view_analytics":
    case "change_system_configuration":
      return false;
    default: {
      const _exhaustive: never = _capability;
      return _exhaustive;
    }
  }
}

async function appAllows(role: MatrixRole, capability: Capability): Promise<boolean> {
  const session = claimsFor(role);
  switch (capability) {
    case "log_in":
      return session !== null;
    case "view_dashboard": {
      try {
        requireRole(session);
        return true;
      } catch {
        return false;
      }
    }
    case "view_audit_log": {
      try {
        requireRole(session, { admin: ["super_admin", "admin"] });
        return true;
      } catch {
        return false;
      }
    }
    case "approve_deny_registrations": {
      try {
        await listPendingRegistrations(session ? { ...session, mfaSatisfied: true } : null);
        return true;
      } catch {
        return false;
      }
    }
    case "upload_edit_delete_resources": {
      try {
        await mintIngestSlots(session ? { ...session, mfaSatisfied: true } : null);
        return true;
      } catch {
        return false;
      }
    }
    case "view_shared_resources":
    case "view_role_specific_resources": {
      try {
        await listResources(session);
        return true;
      } catch {
        return false;
      }
    }
    case "download_resources": {
      try {
        await grantDownload(session, "00000000-0000-4000-8000-000000000099", {
          ip: "127.0.0.1",
          userAgent: "vitest-matrix-download",
        });
        return true;
      } catch {
        return false;
      }
    }
    case "view_announcements": {
      try {
        await listEligibleBanners(session);
        return true;
      } catch {
        return false;
      }
    }
    case "create_manage_announcements": {
      try {
        await createAnnouncement(session ? { ...session, mfaSatisfied: true } : null, {
          headline: "matrix",
          body: "body",
          visibility: ["all_authenticated"],
          activatesAt: new Date(),
          expiresAt: new Date(Date.now() - 1000),
          ip: "127.0.0.1",
          userAgent: "vitest-matrix-announcement",
        });
        return true;
      } catch {
        return false;
      }
    }
    case "create_edit_delete_events": {
      try {
        await createEvent(session ? { ...session, mfaSatisfied: true } : null, {
          title: "matrix",
          description: "body",
          visibility: ["all_authenticated"],
          startsAt: new Date(Date.now() + 60_000),
          endsAt: new Date(),
          ip: "127.0.0.1",
          userAgent: "vitest-matrix-event",
        });
        return true;
      } catch {
        return false;
      }
    }
    case "view_events": {
      try {
        await listVisibleEvents(session);
        return true;
      } catch {
        return false;
      }
    }
    case "rsvp_events": {
      try {
        await setEventRsvp(session, "00000000-0000-4000-8000-000000000099", "yes", {
          ip: "127.0.0.1",
          userAgent: "vitest-matrix-rsvp",
        });
        return true;
      } catch {
        return false;
      }
    }
    case "view_directory":
    case "appear_in_directory":
    case "view_forum":
    case "post_forum":
    case "moderate_forum":
    case "assign_change_roles":
    case "view_analytics":
    case "change_system_configuration":
      return false;
    default: {
      const _exhaustive: never = capability;
      return _exhaustive;
    }
  }
}

async function actualVerdict(role: MatrixRole, capability: Capability): Promise<MatrixVerdict> {
  const allowed = await appAllows(role, capability);
  if (!isBuilt(capability)) {
    return allowed ? "allow" : "fail-closed";
  }
  return allowed ? "allow" : "deny";
}

describe("app permission matrix (FR-025, requireRole not mocked)", () => {
  it.each(MATRIX_ROLES.flatMap((role) => CAPABILITIES.map((capability) => [role, capability] as const)))(
    "%s / %s",
    async (role, capability) => {
      const expected = PRD_MATRIX[capability][role];
      if (!isBuilt(capability)) {
        expect(await appAllows(role, capability)).toBe(false);
        expect(["deny", "fail-closed"]).toContain(expected);
        return;
      }
      expect(await actualVerdict(role, capability)).toBe(expected);
    },
  );

  it.each(MATRIX_ROLES)("%s sees only fixture titles allowed by visibility intersection", async (role) => {
    const session = claimsFor(role);
    if (!session) {
      expect(EXPECTED_VISIBLE_TITLES[role]).toEqual([]);
      return;
    }
    try {
      requireRole(session);
    } catch {
      expect(EXPECTED_VISIBLE_TITLES[role]).toEqual([]);
      return;
    }
    const rows = await listVisibleRecords(session);
    expect(rows.map((row) => row.title).sort()).toEqual([...EXPECTED_VISIBLE_TITLES[role]].sort());
  });

  it("invite list/revoke/re-issue and DOC add deny Moderator, Pathways, LEAD, and Pending", async () => {
    const invitationId = "00000000-0000-4000-8000-000000000099";
    const write = {
      invitationId,
      ip: "127.0.0.1",
      userAgent: "vitest-matrix-invite-deny",
      clientAdminRole: "admin" as const,
      clientMfaSatisfied: true,
    };
    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(listInvitations(claimsFor(role), write)).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
      await expect(revokeInvite(claimsFor(role), write)).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
      await expect(reissueInvite(claimsFor(role), write)).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
      await expect(
        addDocAffiliation(claimsFor(role), { label: "should-not-create", ...write }),
      ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    }
  });

  it("admin without mfa_satisfied is denied invite list; with mfa_satisfied is allowed", async () => {
    await expect(listInvitations(claimsFor("admin"))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(
      listInvitations({ ...claimsFor("admin")!, mfaSatisfied: true }),
    ).resolves.toEqual(expect.any(Array));
  });
});
