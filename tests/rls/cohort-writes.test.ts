import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls, type RlsContext } from "@/lib/db/rls";
import {
  cleanupCohortFixtures,
  createCohort,
  createCohortMember,
  newCohortFixtures,
} from "@/tests/helpers/cohort-fixtures";

/** specs/014-program-cohorts/contracts/rls.md — RLS-COH-W-1..5. */
const fixtures = newCohortFixtures("cohort-w");

const ADMIN: RlsContext = { programRole: "none", adminRole: "admin", status: "active" };
const SUPER: RlsContext = { programRole: "none", adminRole: "super_admin", status: "active" };
const MODERATOR: RlsContext = { programRole: "none", adminRole: "moderator", status: "active" };
const MEMBER: RlsContext = { programRole: "pathways", adminRole: "none", status: "active" };
const PENDING: RlsContext = { programRole: "pathways", adminRole: "none", status: "pending" };

let cohortA = "";
let cohortB = "";
let member = "";
let staffOnly = "";

function denied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /row-level security|permission denied|primary cohort|program_role cannot change/i.test(message);
}

async function attempt(fn: () => Promise<unknown>): Promise<"allow" | "deny"> {
  try {
    await fn();
    return "allow";
  } catch (error) {
    if (denied(error)) {
      return "deny";
    }
    throw error;
  }
}

describe("cohort write policies", () => {
  beforeAll(async () => {
    cohortA = await createCohort(fixtures, { label: "a", programRole: "pathways" });
    cohortB = await createCohort(fixtures, { label: "b", programRole: "pathways" });
    member = await createCohortMember(fixtures, {
      label: "member",
      programRole: "pathways",
      primaryCohortId: cohortA,
    });
    staffOnly = await createCohortMember(fixtures, {
      label: "staff",
      programRole: "none",
      primaryCohortId: null,
      adminRole: "moderator",
    });
  });

  afterAll(async () => {
    await cleanupCohortFixtures(fixtures);
  });

  it("RLS-COH-W-1: only admin and super_admin insert and update networks", async () => {
    for (const [ctx, expected] of [
      [ADMIN, "allow"],
      [SUPER, "allow"],
      [MODERATOR, "deny"],
      [MEMBER, "deny"],
      [PENDING, "deny"],
    ] as const) {
      const id = randomUUID();
      const inserted = await attempt(() =>
        withRls(ctx, (tx) =>
          tx.$executeRaw`INSERT INTO networks (id, name, program_role) VALUES (${id}::uuid, ${`${fixtures.marker}-${id}`}, 'pathways')`,
        ),
      );
      expect(inserted).toBe(expected);
      if (inserted === "allow") {
        fixtures.networkIds.push(id);
      }
      const updated = await withRls(ctx, (tx) =>
        tx.$executeRaw`UPDATE networks SET archived_at = now() WHERE id = ${cohortB}::uuid`,
      ).catch(() => -1);
      expect(updated > 0 ? "allow" : "deny").toBe(expected);
      await migrator.network.update({ where: { id: cohortB }, data: { archivedAt: null } });
    }
  });

  it("RLS-COH-W-1: a cohort's programme cannot change", async () => {
    expect(
      await attempt(() =>
        withRls(ADMIN, (tx) => tx.$executeRaw`UPDATE networks SET program_role = 'lead' WHERE id = ${cohortB}::uuid`),
      ),
    ).toBe("deny");
  });

  it("RLS-COH-W-2: nobody deletes networks through the app role", async () => {
    for (const ctx of [ADMIN, SUPER, MODERATOR, MEMBER]) {
      expect(
        await attempt(() =>
          withRls(ctx, (tx) => tx.$executeRaw`DELETE FROM networks WHERE id = ${cohortB}::uuid`),
        ),
      ).toBe("deny");
    }
  });

  it("RLS-COH-W-3: admins add memberships for program members only", async () => {
    const add = (ctx: RlsContext, userId: string) =>
      attempt(() =>
        withRls(ctx, (tx) =>
          tx.$executeRaw`INSERT INTO user_networks (user_id, network_id) VALUES (${userId}::uuid, ${cohortB}::uuid)`,
        ),
      );
    expect(await add(MODERATOR, member)).toBe("deny");
    expect(await add({ ...MEMBER, userId: member }, member)).toBe("deny");
    expect(await add(ADMIN, staffOnly)).toBe("deny");
    expect(await add(ADMIN, member)).toBe("allow");
  });

  it("RLS-COH-W-4: only admins delete a non-primary membership", async () => {
    const remove = (ctx: RlsContext) =>
      withRls(ctx, (tx) =>
        tx.$executeRaw`DELETE FROM user_networks WHERE user_id = ${member}::uuid AND network_id = ${cohortB}::uuid`,
      );
    await migrator.userNetwork.upsert({
      where: { userId_networkId: { userId: member, networkId: cohortB } },
      create: { userId: member, networkId: cohortB },
      update: {},
    });
    expect(await remove(MODERATOR)).toBe(0);
    expect(await remove({ ...MEMBER, userId: member })).toBe(0);
    expect(await remove(SUPER)).toBe(1);
  });

  it("RLS-COH-W-5: the primary membership cannot be deleted, even by admins", async () => {
    expect(
      await attempt(() =>
        withRls(ADMIN, (tx) =>
          tx.$executeRaw`DELETE FROM user_networks WHERE user_id = ${member}::uuid AND network_id = ${cohortA}::uuid`,
        ),
      ),
    ).toBe("deny");
  });

  it("RLS-COH-W-5: changing users.network_id still moves the primary membership", async () => {
    await migrator.user.update({ where: { id: member }, data: { networkId: cohortB } });
    const memberships = await migrator.userNetwork.findMany({
      where: { userId: member },
      select: { networkId: true },
    });
    expect(memberships.map((row) => row.networkId)).toEqual([cohortB]);
    await migrator.user.update({ where: { id: member }, data: { networkId: cohortA } });
  });
});
