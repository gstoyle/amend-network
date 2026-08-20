import { describe, expect, it } from "vitest";
import type { SessionClaims } from "@/lib/auth/types";
import {
  accountDestinations,
  adminDestinations,
  isCurrent,
  memberDestinations,
} from "@/lib/nav/destinations";
import { claimsFor } from "@/tests/helpers/prd-matrix";

function hrefs(destinations: { href: string }[]): string[] {
  return destinations.map((destination) => destination.href);
}

function allFor(claims: SessionClaims | null): string[] {
  return [
    ...hrefs(memberDestinations(claims)),
    ...hrefs(adminDestinations(claims)),
    ...hrefs(accountDestinations(claims)),
  ];
}

describe("member destinations (T003 / FR-003)", () => {
  it("lists only routes that exist, in PRD B.4 order", () => {
    expect(hrefs(memberDestinations(claimsFor("pathways")))).toEqual([
      "/app",
      "/app/resources",
      "/app/events",
      "/app/forum",
      "/app/directory",
      "/app/guide",
    ]);
  });

  it("includes forum between events and directory", () => {
    expect(hrefs(memberDestinations(claimsFor("lead")))).toContain("/app/forum");
  });

  it("omits the profile index because only privacy and sessions exist", () => {
    expect(allFor(claimsFor("pathways"))).not.toContain("/app/profile");
  });

  it("emits no duplicate href within a single list", () => {
    const list = hrefs(memberDestinations(claimsFor("lead")));
    expect(new Set(list).size).toBe(list.length);
  });

  it("is stable for the same claims", () => {
    const claims = claimsFor("pathways");
    expect(memberDestinations(claims)).toEqual(memberDestinations(claims));
  });
});

describe("administrative destinations never leak (T003 / FR-007, SC-004)", () => {
  it("a member session receives zero administrative destinations", () => {
    for (const role of ["pathways", "lead"] as const) {
      expect(adminDestinations(claimsFor(role))).toEqual([]);
      expect(allFor(claimsFor(role)).join(" ")).not.toContain("/admin");
    }
  });

  it("an anonymous session receives nothing at all", () => {
    expect(allFor(null)).toEqual([]);
  });

  it("an admin session receives administrative destinations", () => {
    expect(hrefs(adminDestinations(claimsFor("admin")))).toContain("/admin/analytics");
  });

  it("an unsatisfied MFA claim does not hide administrative destinations", () => {
    const admin = claimsFor("admin")!;
    expect(admin.mfaSatisfied).toBe(false);
    expect(adminDestinations(admin).length).toBeGreaterThan(0);
    expect(adminDestinations({ ...admin, mfaSatisfied: true })).toEqual(
      adminDestinations(admin),
    );
  });

  it("mirrors each route's own narrowing and never widens it for a moderator", () => {
    const moderator = hrefs(adminDestinations(claimsFor("moderator")));
    expect(moderator).not.toContain("/admin/users/invite");
    expect(moderator).not.toContain("/admin/analytics");
    expect(moderator).toContain("/admin/forum");
  });
});

describe("a client-supplied role changes nothing (T003 / FR-009)", () => {
  it("ignores extra role-shaped fields on the claims object", () => {
    const member = claimsFor("pathways")!;
    const spoofed = {
      ...member,
      role: "super_admin",
      clientAdminRole: "super_admin",
      isAdmin: true,
    } as SessionClaims;
    expect(adminDestinations(spoofed)).toEqual([]);
    expect(memberDestinations(spoofed)).toEqual(memberDestinations(member));
  });
});

describe("restricted status (T003 / FR-019)", () => {
  it("a pending session is offered no destination that would bounce it", () => {
    const pending = claimsFor("pending");
    expect(memberDestinations(pending)).toEqual([]);
    expect(adminDestinations(pending)).toEqual([]);
    expect(hrefs(accountDestinations(pending))).toEqual([]);
  });

  it("a deactivated session is treated the same way", () => {
    const deactivated = { ...claimsFor("pathways")!, status: "deactivated" as const };
    expect(memberDestinations(deactivated)).toEqual([]);
  });
});

describe("account destinations (T003 / FR-006)", () => {
  it("gathers privacy and sessions for an active member", () => {
    expect(hrefs(accountDestinations(claimsFor("pathways")))).toEqual([
      "/app/profile/privacy",
      "/app/profile/sessions",
    ]);
  });

  it("adds the administrative entry point for a staff session", () => {
    expect(hrefs(accountDestinations(claimsFor("admin")))).toContain("/admin");
  });
});

describe("current-section matching (T003 / FR-004, SC-005)", () => {
  const member = claimsFor("pathways");

  function currentFor(path: string): string[] {
    return memberDestinations(member)
      .filter((destination) => isCurrent(path, destination))
      .map((destination) => destination.href);
  }

  it("marks home only on an exact match", () => {
    expect(currentFor("/app")).toEqual(["/app"]);
  });

  it("does not let home claim a nested page", () => {
    expect(currentFor("/app/events")).toEqual(["/app/events"]);
  });

  it("keeps the parent section current on a detail page", () => {
    expect(currentFor("/app/events/8f2c1a90-0000-4000-8000-000000000001")).toEqual([
      "/app/events",
    ]);
  });

  it("marks exactly one entry current on every member path", () => {
    for (const path of [
      "/app",
      "/app/resources",
      "/app/resources/abc",
      "/app/events",
      "/app/forum",
      "/app/directory",
      "/app/directory/abc",
      "/app/forum/t/abc",
      "/app/guide",
      "/app/guide/signing-in",
    ]) {
      expect(currentFor(path), path).toHaveLength(1);
    }
  });

  it("does not match a sibling whose path merely shares a prefix string", () => {
    expect(currentFor("/app/resourcesabc")).toEqual([]);
  });

  it("marks nothing current when the pathname header is absent", () => {
    expect(currentFor("")).toEqual([]);
  });
});
