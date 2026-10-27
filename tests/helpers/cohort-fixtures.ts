import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import type { AdminRole, ProgramRole, UserStatus } from "@/lib/auth/types";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";

export type CohortFixtures = {
  marker: string;
  networkIds: string[];
  userIds: string[];
};

export function newCohortFixtures(prefix: string): CohortFixtures {
  return { marker: `${prefix}-${randomUUID()}`, networkIds: [], userIds: [] };
}

export async function createCohort(
  fixtures: CohortFixtures,
  input: { label: string; programRole: "pathways" | "lead"; archived?: boolean },
): Promise<string> {
  const row = await migrator.network.create({
    data: {
      name: `${fixtures.marker}-${input.label}`,
      programRole: input.programRole,
      archivedAt: input.archived ? new Date() : null,
    },
    select: { id: true },
  });
  fixtures.networkIds.push(row.id);
  return row.id;
}

export async function createCohortMember(
  fixtures: CohortFixtures,
  input: {
    label: string;
    programRole: ProgramRole;
    primaryCohortId: string | null;
    extraCohortIds?: string[];
    adminRole?: AdminRole;
    status?: UserStatus;
  },
): Promise<string> {
  const id = randomUUID();
  const email = `${fixtures.marker}-${input.label}@example.com`;
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(email),
      emailEncrypted: encryptPii(email),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii("Cohort"),
      lastNameEncrypted: encryptPii("Member"),
      networkId: input.primaryCohortId,
      programRole: input.programRole,
      adminRole: input.adminRole ?? "none",
      status: input.status ?? "active",
    },
  });
  fixtures.userIds.push(id);
  for (const networkId of input.extraCohortIds ?? []) {
    await migrator.userNetwork.create({ data: { userId: id, networkId } });
  }
  return id;
}

/** Users first (memberships cascade), then the cohorts they pointed at. */
export async function cleanupCohortFixtures(fixtures: CohortFixtures): Promise<void> {
  if (fixtures.userIds.length > 0) {
    await migrator.user.deleteMany({ where: { id: { in: fixtures.userIds } } });
  }
  if (fixtures.networkIds.length > 0) {
    await migrator.network.deleteMany({ where: { id: { in: fixtures.networkIds } } });
  }
  fixtures.userIds.length = 0;
  fixtures.networkIds.length = 0;
}
