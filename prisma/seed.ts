import { randomUUID } from "node:crypto";
import { AdminRole, ProgramRole, UserStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";

type SeedUser = {
  email: string;
  programRole: ProgramRole;
  adminRole: AdminRole;
  status: UserStatus;
  mfaEnabled: boolean;
  networkName?: "Pathways to Change" | "LEAD";
};

const SEED_USERS: SeedUser[] = [
  {
    email: "superadmin@local",
    programRole: "none",
    adminRole: "super_admin",
    status: "active",
    mfaEnabled: true,
  },
  {
    email: "admin@local",
    programRole: "none",
    adminRole: "admin",
    status: "active",
    mfaEnabled: false,
  },
  {
    email: "moderator@local",
    programRole: "none",
    adminRole: "moderator",
    status: "active",
    mfaEnabled: true,
  },
  {
    email: "pathways@local",
    programRole: "pathways",
    adminRole: "none",
    status: "active",
    mfaEnabled: false,
    networkName: "Pathways to Change",
  },
  {
    email: "lead@local",
    programRole: "lead",
    adminRole: "none",
    status: "active",
    mfaEnabled: false,
    networkName: "LEAD",
  },
  {
    email: "pending@local",
    programRole: "none",
    adminRole: "none",
    status: "pending",
    mfaEnabled: false,
  },
  {
    email: "denied@local",
    programRole: "none",
    adminRole: "none",
    status: "denied",
    mfaEnabled: false,
  },
  {
    email: "deactivated@local",
    programRole: "pathways",
    adminRole: "none",
    status: "deactivated",
    mfaEnabled: false,
    networkName: "Pathways to Change",
  },
];

async function seed(): Promise<void> {
  const passwordHash = await hashPassword(env().SEED_PASSWORD);
  const mfaSecret = env().SEED_MFA_SECRET
    ? encryptPii(env().SEED_MFA_SECRET as string)
    : null;

  const pathways = await migrator.network.upsert({
    where: { name: "Pathways to Change" },
    update: {},
    create: { id: randomUUID(), name: "Pathways to Change", programRole: "pathways" },
  });
  const lead = await migrator.network.upsert({
    where: { name: "LEAD" },
    update: {},
    create: { id: randomUUID(), name: "LEAD", programRole: "lead" },
  });

  const networks = {
    "Pathways to Change": pathways.id,
    LEAD: lead.id,
  };

  for (const user of SEED_USERS) {
    const emailLookup = hmacEmailLookup(user.email);
    const existing = await migrator.user.findUnique({ where: { emailLookup } });
    const data = {
      emailLookup,
      emailEncrypted: encryptPii(user.email),
      passwordHash,
      firstNameEncrypted: encryptPii("Seed"),
      lastNameEncrypted: encryptPii(user.email.split("@")[0] ?? "user"),
      networkId: user.networkName ? networks[user.networkName] : null,
      programRole: user.programRole,
      adminRole: user.adminRole,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      mfaSecretEncrypted: user.mfaEnabled ? mfaSecret : null,
    };
    if (existing) {
      await migrator.user.update({ where: { id: existing.id }, data });
    } else {
      await migrator.user.create({ data: { id: randomUUID(), ...data } });
    }
  }

  const fixtures: { title: string; visibility: string[] }[] = [
    { title: "Pathways only", visibility: ["pathways"] },
    { title: "LEAD only", visibility: ["lead"] },
    { title: "All authenticated", visibility: ["all_authenticated"] },
    { title: "Both programs", visibility: ["pathways", "lead"] },
  ];

  const existingFixtures = await migrator.visibilityRecord.findMany();
  if (existingFixtures.length === 0) {
    await migrator.visibilityRecord.createMany({
      data: fixtures.map((row) => ({ id: randomUUID(), ...row })),
    });
  }
}

seed()
  .then(async () => {
    await migrator.$disconnect();
  })
  .catch(async (error: unknown) => {
    await migrator.$disconnect();
    throw error;
  });
