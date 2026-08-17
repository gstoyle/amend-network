import { randomUUID } from "node:crypto";
import { AdminRole, ProgramRole, UserStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { putObject } from "@/lib/storage/client";

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

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 72 72]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function seedResources(): Promise<void> {
  const admin = await migrator.user.findUnique({
    where: { emailLookup: hmacEmailLookup("admin@local") },
  });
  if (!admin) {
    throw new Error("seed admin@local is required before resources");
  }

  const resourceFixtures: {
    title: string;
    visibility: string[];
    withdrawn: boolean;
  }[] = [
    { title: "Seed shared PDF", visibility: ["all_authenticated"], withdrawn: false },
    { title: "Seed Pathways PDF", visibility: ["pathways"], withdrawn: false },
    { title: "Seed LEAD PDF", visibility: ["lead"], withdrawn: false },
    { title: "Seed both-program PDF", visibility: ["pathways", "lead"], withdrawn: false },
    { title: "Seed withdrawn PDF", visibility: ["all_authenticated"], withdrawn: true },
  ];

  let storageOk = true;
  for (const fixture of resourceFixtures) {
    const existing = await migrator.resource.findFirst({ where: { title: fixture.title } });
    if (existing) {
      if (storageOk) {
        try {
          await putObject(existing.fileObjectKey, MINIMAL_PDF, "application/pdf");
          await putObject(existing.thumbnailObjectKey, MINIMAL_PNG, "image/png");
        } catch (error: unknown) {
          storageOk = false;
          const message = error instanceof Error ? error.message : "unknown storage error";
          console.warn(`MinIO seed upload failed for existing ${fixture.title}. ${message}`);
        }
      }
      continue;
    }
    const id = randomUUID();
    const fileKey = `resources/${id}/file.pdf`;
    const thumbKey = `resources/${id}/thumb.png`;
    if (storageOk) {
      try {
        await putObject(fileKey, MINIMAL_PDF, "application/pdf");
        await putObject(thumbKey, MINIMAL_PNG, "image/png");
      } catch (error: unknown) {
        storageOk = false;
        const message = error instanceof Error ? error.message : "unknown storage error";
        console.warn(`MinIO seed upload failed; inserting resource rows without objects. ${message}`);
      }
    }
    await migrator.resource.create({
      data: {
        id,
        title: fixture.title,
        previewText: `Preview for ${fixture.title}`,
        thumbnailObjectKey: thumbKey,
        sourceLabel: "Amend",
        tags: [],
        fileObjectKey: fileKey,
        fileSizeBytes: BigInt(MINIMAL_PDF.length),
        fileMimeType: "application/pdf",
        visibility: fixture.visibility,
        uploadedBy: admin.id,
        deletedAt: fixture.withdrawn ? new Date() : null,
      },
    });
  }
}

async function seedAnnouncements(): Promise<void> {
  const admin = await migrator.user.findUnique({
    where: { emailLookup: hmacEmailLookup("admin@local") },
  });
  if (!admin) {
    throw new Error("seed admin@local is required before announcements");
  }

  const now = Date.now();
  const fixtures: {
    headline: string;
    visibility: string[];
    activatesAt: Date;
    expiresAt: Date;
    deletedAt: Date | null;
  }[] = [
    {
      headline: "Seed shared banner",
      visibility: ["all_authenticated"],
      activatesAt: new Date(now - 60_000),
      expiresAt: new Date(now + 7 * 24 * 60 * 60_000),
      deletedAt: null,
    },
    {
      headline: "Seed Pathways banner A",
      visibility: ["pathways"],
      activatesAt: new Date(now - 3 * 60_000),
      expiresAt: new Date(now + 7 * 24 * 60 * 60_000),
      deletedAt: null,
    },
    {
      headline: "Seed Pathways banner B",
      visibility: ["pathways"],
      activatesAt: new Date(now - 2 * 60_000),
      expiresAt: new Date(now + 7 * 24 * 60 * 60_000),
      deletedAt: null,
    },
    {
      headline: "Seed Pathways banner C",
      visibility: ["pathways"],
      activatesAt: new Date(now - 1 * 60_000),
      expiresAt: new Date(now + 7 * 24 * 60 * 60_000),
      deletedAt: null,
    },
    {
      headline: "Seed LEAD banner",
      visibility: ["lead"],
      activatesAt: new Date(now - 60_000),
      expiresAt: new Date(now + 7 * 24 * 60 * 60_000),
      deletedAt: null,
    },
    {
      headline: "Seed both-program banner",
      visibility: ["pathways", "lead"],
      activatesAt: new Date(now - 60_000),
      expiresAt: new Date(now + 7 * 24 * 60 * 60_000),
      deletedAt: null,
    },
    {
      headline: "Seed scheduled banner",
      visibility: ["all_authenticated"],
      activatesAt: new Date(now + 7 * 24 * 60 * 60_000),
      expiresAt: new Date(now + 14 * 24 * 60 * 60_000),
      deletedAt: null,
    },
    {
      headline: "Seed expired banner",
      visibility: ["all_authenticated"],
      activatesAt: new Date(now - 14 * 24 * 60 * 60_000),
      expiresAt: new Date(now - 7 * 24 * 60 * 60_000),
      deletedAt: null,
    },
    {
      headline: "Seed withdrawn banner",
      visibility: ["all_authenticated"],
      activatesAt: new Date(now - 60_000),
      expiresAt: new Date(now + 7 * 24 * 60 * 60_000),
      deletedAt: new Date(),
    },
  ];

  for (const fixture of fixtures) {
    const existing = await migrator.announcement.findFirst({
      where: { headline: fixture.headline },
    });
    if (existing) {
      continue;
    }
    await migrator.announcement.create({
      data: {
        headline: fixture.headline,
        body: `Body for ${fixture.headline}`,
        visibility: fixture.visibility,
        activatesAt: fixture.activatesAt,
        expiresAt: fixture.expiresAt,
        createdBy: admin.id,
        deletedAt: fixture.deletedAt,
      },
    });
  }
}

async function seedEvents(): Promise<void> {
  const admin = await migrator.user.findUnique({
    where: { emailLookup: hmacEmailLookup("admin@local") },
  });
  if (!admin) {
    throw new Error("seed admin@local is required before events");
  }

  const now = Date.now();
  const fixtures: {
    title: string;
    visibility: string[];
    startsAt: Date;
    endsAt: Date;
    cancelledAt: Date | null;
    isVirtual: boolean;
    joinUrl: string | null;
    capacity: number | null;
  }[] = [
    {
      title: "Seed shared event",
      visibility: ["all_authenticated"],
      startsAt: new Date(now + 2 * 24 * 60 * 60_000),
      endsAt: new Date(now + 2 * 24 * 60 * 60_000 + 60 * 60_000),
      cancelledAt: null,
      isVirtual: false,
      joinUrl: null,
      capacity: null,
    },
    {
      title: "Seed Pathways event",
      visibility: ["pathways"],
      startsAt: new Date(now + 3 * 24 * 60 * 60_000),
      endsAt: new Date(now + 3 * 24 * 60 * 60_000 + 60 * 60_000),
      cancelledAt: null,
      isVirtual: false,
      joinUrl: null,
      capacity: null,
    },
    {
      title: "Seed LEAD event",
      visibility: ["lead"],
      startsAt: new Date(now + 4 * 24 * 60 * 60_000),
      endsAt: new Date(now + 4 * 24 * 60 * 60_000 + 60 * 60_000),
      cancelledAt: null,
      isVirtual: false,
      joinUrl: null,
      capacity: null,
    },
    {
      title: "Seed both-program event",
      visibility: ["pathways", "lead"],
      startsAt: new Date(now + 5 * 24 * 60 * 60_000),
      endsAt: new Date(now + 5 * 24 * 60 * 60_000 + 60 * 60_000),
      cancelledAt: null,
      isVirtual: false,
      joinUrl: null,
      capacity: null,
    },
    {
      title: "Seed cancelled event",
      visibility: ["all_authenticated"],
      startsAt: new Date(now + 6 * 24 * 60 * 60_000),
      endsAt: new Date(now + 6 * 24 * 60 * 60_000 + 60 * 60_000),
      cancelledAt: new Date(),
      isVirtual: false,
      joinUrl: null,
      capacity: null,
    },
    {
      title: "Seed virtual outside reveal",
      visibility: ["all_authenticated"],
      startsAt: new Date(now + 90 * 60_000),
      endsAt: new Date(now + 150 * 60_000),
      cancelledAt: null,
      isVirtual: true,
      joinUrl: "https://meet.example.test/outside",
      capacity: null,
    },
    {
      title: "Seed virtual inside reveal",
      visibility: ["all_authenticated"],
      startsAt: new Date(now - 30 * 60_000),
      endsAt: new Date(now + 90 * 60_000),
      cancelledAt: null,
      isVirtual: true,
      joinUrl: "https://meet.example.test/inside",
      capacity: null,
    },
    {
      title: "Seed capacity-1 event",
      visibility: ["all_authenticated"],
      startsAt: new Date(now + 7 * 24 * 60 * 60_000),
      endsAt: new Date(now + 7 * 24 * 60 * 60_000 + 60 * 60_000),
      cancelledAt: null,
      isVirtual: false,
      joinUrl: null,
      capacity: 1,
    },
  ];

  for (const fixture of fixtures) {
    const existing = await migrator.event.findFirst({
      where: { title: fixture.title },
    });
    if (existing) {
      continue;
    }
    const created = await migrator.event.create({
      data: {
        title: fixture.title,
        description: `Body for ${fixture.title}`,
        startsAt: fixture.startsAt,
        endsAt: fixture.endsAt,
        visibility: fixture.visibility,
        isVirtual: fixture.isVirtual,
        capacity: fixture.capacity,
        createdBy: admin.id,
        cancelledAt: fixture.cancelledAt,
      },
    });
    if (fixture.joinUrl) {
      await migrator.eventJoinLink.create({
        data: { eventId: created.id, url: fixture.joinUrl },
      });
    }
  }
}

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

  const affiliations: { label: string; active: boolean }[] = [
    { label: "Test Agency A", active: true },
    { label: "Test Agency B", active: true },
    { label: "Test Agency Inactive", active: false },
  ];
  for (const affiliation of affiliations) {
    await migrator.docAffiliation.upsert({
      where: { label: affiliation.label },
      update: { active: affiliation.active },
      create: { id: randomUUID(), ...affiliation },
    });
  }

  await seedResources();
  await seedAnnouncements();
  await seedEvents();
}

seed()
  .then(async () => {
    await migrator.$disconnect();
  })
  .catch(async (error: unknown) => {
    await migrator.$disconnect();
    throw error;
  });
