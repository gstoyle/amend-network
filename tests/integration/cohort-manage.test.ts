import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import {
  addCohortMember,
  COHORT_DUPLICATE_NAME,
  COHORT_NO_ELIGIBLE_MEMBER,
  COHORT_PRIMARY_REMOVAL,
  createCohort,
  getCohortForAdmin,
  listCohortsForAdmin,
  removeCohortMember,
  renameCohort,
  setCohortArchived,
} from "@/lib/cohorts/manage";
import { migrator } from "@/lib/db/migrator";
import { listLaunchNetworks } from "@/lib/registration/register";
import {
  cleanupCohortFixtures,
  createCohort as createCohortFixture,
  createCohortMember,
  newCohortFixtures,
} from "@/tests/helpers/cohort-fixtures";
import { claimsFor } from "@/tests/helpers/prd-matrix";

/** specs/014-program-cohorts US1, contracts/http.md `/admin/cohorts`. */
const fixtures = newCohortFixtures("cohort-manage");
const IP = "127.0.0.1";
const USER_AGENT = `vitest-${fixtures.marker}`;
const write = { ip: IP, userAgent: USER_AGENT };

function adminSession() {
  return { ...claimsFor("admin")!, mfaEnabled: true, mfaSatisfied: true };
}

let primaryCohort = "";
let memberId = "";
const memberEmail = () => `${fixtures.marker}-member@example.com`;
const staffEmail = () => `${fixtures.marker}-staff@example.com`;

describe("cohort management (014 US1)", () => {
  beforeAll(async () => {
    primaryCohort = await createCohortFixture(fixtures, { label: "primary", programRole: "pathways" });
    memberId = await createCohortMember(fixtures, {
      label: "member",
      programRole: "pathways",
      primaryCohortId: primaryCohort,
    });
    await createCohortMember(fixtures, {
      label: "staff",
      programRole: "none",
      primaryCohortId: null,
      adminRole: "moderator",
    });
  });

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
  });

  afterAll(async () => {
    await cleanupCohortFixtures(fixtures);
  });

  async function created(label: string, programRole: "pathways" | "lead" = "pathways") {
    const row = await createCohort(adminSession(), {
      name: `${fixtures.marker} ${label}`,
      programRole,
      ...write,
    });
    fixtures.networkIds.push(row.id);
    return row;
  }

  it("creates, renames, archives, and unarchives, writing audit rows with ids only", async () => {
    const cohort = await created("Norway April 27");
    expect(cohort).toMatchObject({ programRole: "pathways", archived: false, memberCount: 0 });

    const renamed = await renameCohort(adminSession(), {
      id: cohort.id,
      name: `${fixtures.marker} Norway Apr 27`,
      ...write,
    });
    expect(renamed.name).toBe(`${fixtures.marker} Norway Apr 27`);

    await setCohortArchived(adminSession(), { id: cohort.id, archived: true, ...write });
    expect((await listLaunchNetworks()).map((row) => row.id)).not.toContain(cohort.id);
    expect((await listLaunchNetworks({ includeArchived: true })).map((row) => row.id)).toContain(
      cohort.id,
    );
    await setCohortArchived(adminSession(), { id: cohort.id, archived: false, ...write });
    expect((await listLaunchNetworks()).map((row) => row.id)).toContain(cohort.id);

    const rows = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((row) => row.action)).toEqual([
      "cohort_created",
      "cohort_renamed",
      "cohort_archived",
      "cohort_unarchived",
    ]);
    for (const row of rows) {
      expect(row.entityType).toBe("cohort");
      expect(row.entityId).toBe(cohort.id);
      expect(JSON.stringify(row.metadata)).not.toContain(fixtures.marker);
    }
  });

  it("refuses a duplicate name regardless of case", async () => {
    const cohort = await created("UK Spring 27");
    await expect(
      createCohort(adminSession(), {
        name: `${fixtures.marker} uk spring 27`.toUpperCase(),
        programRole: "lead",
        ...write,
      }),
    ).rejects.toThrowError(COHORT_DUPLICATE_NAME);
    const other = await created("UK Autumn 27");
    await expect(
      renameCohort(adminSession(), { id: other.id, name: cohort.name.toLowerCase(), ...write }),
    ).rejects.toThrowError(COHORT_DUPLICATE_NAME);
  });

  it("lists cohorts with member counts", async () => {
    const list = await listCohortsForAdmin(adminSession());
    const primary = list.find((row) => row.id === primaryCohort);
    expect(primary).toMatchObject({ programRole: "pathways", memberCount: 1, archived: false });
  });

  it("adds and removes an extra member by email, refusing the primary cohort", async () => {
    const extra = await created("Repeat travellers");
    await addCohortMember(adminSession(), { cohortId: extra.id, email: memberEmail(), ...write });

    const detail = await getCohortForAdmin(adminSession(), extra.id);
    expect(detail?.members).toEqual([
      expect.objectContaining({ userId: memberId, name: "Cohort Member", primary: false }),
    ]);

    await removeCohortMember(adminSession(), { cohortId: extra.id, userId: memberId, ...write });
    expect((await getCohortForAdmin(adminSession(), extra.id))?.members).toEqual([]);

    await expect(
      removeCohortMember(adminSession(), { cohortId: primaryCohort, userId: memberId, ...write }),
    ).rejects.toThrowError(COHORT_PRIMARY_REMOVAL);

    const actions = (
      await migrator.auditLog.findMany({
        where: { userAgent: USER_AGENT, action: { in: ["cohort_member_added", "cohort_member_removed"] } },
        orderBy: { createdAt: "asc" },
      })
    ).map((row) => [row.action, row.targetUserId]);
    expect(actions).toEqual([
      ["cohort_member_added", memberId],
      ["cohort_member_removed", memberId],
    ]);
  });

  it("gives one generic refusal for an unknown email, a staff-only account, or an existing member", async () => {
    const extra = await created("Generic refusals");
    for (const email of [`${fixtures.marker}-nobody@example.com`, staffEmail()]) {
      await expect(
        addCohortMember(adminSession(), { cohortId: extra.id, email, ...write }),
      ).rejects.toThrowError(COHORT_NO_ELIGIBLE_MEMBER);
    }
    await expect(
      addCohortMember(adminSession(), { cohortId: primaryCohort, email: memberEmail(), ...write }),
    ).rejects.toThrowError(COHORT_NO_ELIGIBLE_MEMBER);
  });

  it("returns null for an unknown cohort id", async () => {
    expect(await getCohortForAdmin(adminSession(), "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("refuses moderators and members, even with client role claims", async () => {
    for (const role of ["moderator", "pathways"] as const) {
      await expect(
        createCohort(claimsFor(role), {
          name: `${fixtures.marker} ${role}`,
          programRole: "pathways",
          ...write,
          clientAdminRole: "admin",
          clientMfaSatisfied: true,
        }),
      ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
      await expect(listCohortsForAdmin(claimsFor(role))).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    }
  });
});
