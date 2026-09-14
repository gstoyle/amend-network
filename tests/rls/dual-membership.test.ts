import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { IMMERSION_NETWORK_NAME, LEAD_NETWORK_NAME } from "@/lib/db/visibility";
import { env } from "@/lib/env";

const MARKER = `dual-rls-${randomUUID()}`;

async function insertMember(input: {
  id: string;
  email: string;
  programRole: "pathways" | "lead";
  networkId: string;
}): Promise<void> {
  await migrator.user.create({
    data: {
      id: input.id,
      emailLookup: hmacEmailLookup(input.email),
      emailEncrypted: encryptPii(input.email),
      passwordHash: await hashPassword(env().SEED_PASSWORD),
      firstNameEncrypted: encryptPii("Dual"),
      lastNameEncrypted: encryptPii("Member"),
      networkId: input.networkId,
      programRole: input.programRole,
      adminRole: "none",
      status: "active",
    },
  });
}

describe("dual programme membership RLS", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("a member in both networks sees Immersion-only and LEAD-only fixtures", async () => {
    const immersion = await migrator.network.findUnique({
      where: { name: IMMERSION_NETWORK_NAME },
    });
    const lead = await migrator.network.findUnique({ where: { name: LEAD_NETWORK_NAME } });
    if (!immersion || !lead) {
      throw new Error("launch networks are required");
    }

    const onlyImmersion = randomUUID();
    const both = randomUUID();
    createdUserIds.push(onlyImmersion, both);

    await insertMember({
      id: onlyImmersion,
      email: `${MARKER}-immersion@example.com`,
      programRole: "pathways",
      networkId: immersion.id,
    });
    await insertMember({
      id: both,
      email: `${MARKER}-both@example.com`,
      programRole: "pathways",
      networkId: immersion.id,
    });
    await migrator.userNetwork.create({
      data: { userId: both, networkId: lead.id },
    });

    const ctx = {
      programRole: "pathways" as const,
      adminRole: "none" as const,
      status: "active" as const,
    };

    const immersionTitles = await withRls({ ...ctx, userId: onlyImmersion }, async (tx) =>
      (await tx.visibilityRecord.findMany()).map((row) => row.title),
    );
    expect(immersionTitles).toContain("Pathways only");
    expect(immersionTitles).not.toContain("LEAD only");

    const bothTitles = await withRls({ ...ctx, userId: both }, async (tx) =>
      (await tx.visibilityRecord.findMany()).map((row) => row.title),
    );
    expect(bothTitles).toEqual(
      expect.arrayContaining(["Pathways only", "LEAD only", "All authenticated", "Both programs"]),
    );
  });
});
