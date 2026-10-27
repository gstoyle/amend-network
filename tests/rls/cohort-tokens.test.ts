import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls, type RlsContext } from "@/lib/db/rls";
import {
  cleanupCohortFixtures,
  createCohort,
  createCohortMember,
  newCohortFixtures,
} from "@/tests/helpers/cohort-fixtures";

/** specs/014-program-cohorts/contracts/rls.md — token derivation. */
const fixtures = newCohortFixtures("cohort-tok");
let cohortA = "";
let cohortB = "";
let member = "";
let dual = "";
let pending = "";

async function tokensFor(ctx: RlsContext): Promise<string[]> {
  return withRls(ctx, async (tx) => {
    const rows = await tx.$queryRaw<{ tokens: string[] }[]>`SELECT app_role_tokens() AS tokens`;
    return rows[0]?.tokens ?? [];
  });
}

describe("cohort token derivation", () => {
  beforeAll(async () => {
    cohortA = await createCohort(fixtures, { label: "a", programRole: "pathways" });
    cohortB = await createCohort(fixtures, { label: "b", programRole: "lead" });
    member = await createCohortMember(fixtures, {
      label: "member",
      programRole: "pathways",
      primaryCohortId: cohortA,
    });
    dual = await createCohortMember(fixtures, {
      label: "dual",
      programRole: "pathways",
      primaryCohortId: cohortA,
      extraCohortIds: [cohortB],
    });
    pending = await createCohortMember(fixtures, {
      label: "pending",
      programRole: "pathways",
      primaryCohortId: cohortA,
      status: "pending",
    });
  });

  afterAll(async () => {
    await cleanupCohortFixtures(fixtures);
  });

  it("RLS-COH-TOK-1: an active member carries their programme and cohort", async () => {
    const tokens = await tokensFor({
      userId: member,
      programRole: "pathways",
      adminRole: "none",
      status: "active",
    });
    expect(tokens).toEqual(
      expect.arrayContaining(["all_authenticated", "pathways", `cohort:${cohortA}`]),
    );
    expect(tokens).not.toContain("lead");
    expect(tokens).not.toContain(`cohort:${cohortB}`);
  });

  it("RLS-COH-TOK-2: a second cohort in another programme adds both tokens", async () => {
    const tokens = await tokensFor({
      userId: dual,
      programRole: "pathways",
      adminRole: "none",
      status: "active",
    });
    expect(tokens).toEqual(
      expect.arrayContaining(["pathways", "lead", `cohort:${cohortA}`, `cohort:${cohortB}`]),
    );
  });

  it("RLS-COH-TOK-3: a moderator carries every programme and cohort", async () => {
    const tokens = await tokensFor({
      userId: member,
      programRole: "none",
      adminRole: "moderator",
      status: "active",
    });
    expect(tokens).toEqual(
      expect.arrayContaining(["pathways", "lead", `cohort:${cohortA}`, `cohort:${cohortB}`]),
    );
  });

  it("RLS-COH-TOK-4: a pending member carries nothing", async () => {
    const tokens = await tokensFor({
      userId: pending,
      programRole: "pathways",
      adminRole: "none",
      status: "pending",
    });
    expect(tokens).toEqual([]);
  });

  it("RLS-COH-TOK-5: removing a cohort takes effect on the next statement", async () => {
    const [before, after] = await withRls(
      { userId: dual, programRole: "pathways", adminRole: "none", status: "active" },
      async (tx) => {
        const read = async () =>
          (await tx.$queryRaw<{ tokens: string[] }[]>`SELECT app_role_tokens() AS tokens`)[0]
            ?.tokens ?? [];
        const first = await read();
        await migrator.userNetwork.delete({
          where: { userId_networkId: { userId: dual, networkId: cohortB } },
        });
        return [first, await read()] as const;
      },
    );
    expect(before).toContain(`cohort:${cohortB}`);
    expect(after).not.toContain(`cohort:${cohortB}`);
    expect(after).toContain(`cohort:${cohortA}`);
  });
});
