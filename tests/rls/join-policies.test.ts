import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import { env } from "@/lib/env";

const MARKER = `join-policies-${randomUUID()}`;

function isRlsDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /row-level security policy|permission denied/i.test(message);
}

async function insertUserRaw(
  tx: { $executeRaw: typeof migrator.$executeRaw },
  input: {
    id: string;
    email: string;
    status: "pending" | "active";
    programRole: "none" | "pathways" | "lead";
    adminRole: "none" | "admin";
    networkId?: string | null;
  },
): Promise<void> {
  const lookup = hmacEmailLookup(input.email);
  const encrypted = encryptPii(input.email);
  const passwordHash = await hashPassword(env().SEED_PASSWORD);
  await tx.$executeRaw`
    INSERT INTO users (
      id, email_lookup, email_encrypted, password_hash,
      program_role, admin_role, status, network_id, updated_at
    ) VALUES (
      ${input.id}::uuid,
      ${Buffer.from(lookup)},
      ${Buffer.from(encrypted)},
      ${passwordHash},
      ${input.programRole}::"ProgramRole",
      ${input.adminRole}::"AdminRole",
      ${input.status}::"UserStatus",
      ${input.networkId}::uuid,
      CURRENT_TIMESTAMP
    )
  `;
}

async function seedUser(email: string) {
  const user = await migrator.user.findUnique({
    where: { emailLookup: hmacEmailLookup(email) },
  });
  if (!user) {
    throw new Error(`seed user ${email} is required`);
  }
  return user;
}

describe("join-flow RLS (GUCs only, no requireRole)", () => {
  const createdUserIds: string[] = [];
  const createdAffiliationIds: string[] = [];
  const createdInvitationIds: string[] = [];
  const createdNetworkIds: string[] = [];

  afterEach(async () => {
    if (createdInvitationIds.length > 0) {
      await migrator.invitation.deleteMany({ where: { id: { in: createdInvitationIds } } });
      createdInvitationIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    if (createdAffiliationIds.length > 0) {
      await migrator.docAffiliation.deleteMany({ where: { id: { in: createdAffiliationIds } } });
      createdAffiliationIds.length = 0;
    }
    if (createdNetworkIds.length > 0) {
      await migrator.network.deleteMany({ where: { id: { in: createdNetworkIds } } });
      createdNetworkIds.length = 0;
    }
  });

  it("registration mode inserts a pending member-shaped user", async () => {
    const id = randomUUID();
    createdUserIds.push(id);
    await withRls({ authMode: "registration" }, async (tx) => {
      await insertUserRaw(tx, {
        id,
        email: `${MARKER}-ok@example.com`,
        status: "pending",
        programRole: "none",
        adminRole: "none",
        networkId: null,
      });
    });
    const row = await migrator.user.findUnique({ where: { id } });
    expect(row?.status).toBe("pending");
    expect(row?.adminRole).toBe("none");
  });

  it("registration INSERT does not constrain network_id to a launch network (FK-valid extra network is accepted)", async () => {
    const extra = await migrator.network.create({
      data: { id: randomUUID(), name: `${MARKER}-extra`, programRole: "pathways" },
    });
    createdNetworkIds.push(extra.id);
    const id = randomUUID();
    createdUserIds.push(id);
    await withRls({ authMode: "registration" }, async (tx) => {
      await insertUserRaw(tx, {
        id,
        email: `${MARKER}-net@example.com`,
        status: "pending",
        programRole: "none",
        adminRole: "none",
        networkId: extra.id,
      });
    });
    const row = await migrator.user.findUnique({ where: { id } });
    expect(row?.networkId).toBe(extra.id);
  });

  it("registration mode rejects admin_role or active status", async () => {
    const adminId = randomUUID();
    const activeId = randomUUID();
    await expect(
      withRls({ authMode: "registration" }, async (tx) => {
        await insertUserRaw(tx, {
          id: adminId,
          email: `${MARKER}-admin@example.com`,
          status: "pending",
          programRole: "none",
          adminRole: "admin",
        });
      }),
    ).rejects.toSatisfy(isRlsDenied);
    await expect(
      withRls({ authMode: "registration" }, async (tx) => {
        await insertUserRaw(tx, {
          id: activeId,
          email: `${MARKER}-active@example.com`,
          status: "active",
          programRole: "none",
          adminRole: "none",
        });
      }),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("pending own-row cannot self-activate", async () => {
    const pending = await seedUser("pending@local");
    await expect(
      withRls(
        {
          userId: pending.id,
          programRole: pending.programRole,
          adminRole: pending.adminRole,
          status: pending.status,
        },
        async (tx) => {
          await tx.user.update({
            where: { id: pending.id },
            data: { status: "active" },
          });
        },
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("moderator cannot SELECT other users, invitations, or mutate affiliations", async () => {
    const moderator = await seedUser("moderator@local");
    const pending = await seedUser("pending@local");
    const seen = await withRls(
      {
        userId: moderator.id,
        programRole: moderator.programRole,
        adminRole: moderator.adminRole,
        status: moderator.status,
      },
      async (tx) => ({
        others: await tx.user.findMany({ where: { id: pending.id } }),
        invitations: await tx.invitation.findMany(),
      }),
    );
    expect(seen.others).toHaveLength(0);
    expect(seen.invitations).toHaveLength(0);

    await expect(
      withRls(
        {
          userId: moderator.id,
          programRole: moderator.programRole,
          adminRole: moderator.adminRole,
          status: moderator.status,
        },
        async (tx) => {
          await tx.docAffiliation.create({
            data: { label: `${MARKER}-mod`, active: true },
          });
        },
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("admin can SELECT pending users and INSERT affiliations and pending invitations", async () => {
    const admin = await seedUser("admin@local");
    const pending = await seedUser("pending@local");
    const affiliationId = randomUUID();
    const invitationId = randomUUID();
    createdAffiliationIds.push(affiliationId);
    createdInvitationIds.push(invitationId);

    const result = await withRls(
      {
        userId: admin.id,
        programRole: admin.programRole,
        adminRole: admin.adminRole,
        status: admin.status,
      },
      async (tx) => {
        const users = await tx.user.findMany({ where: { id: pending.id } });
        await tx.docAffiliation.create({
          data: { id: affiliationId, label: `${MARKER}-admin`, active: true },
        });
        const network = await tx.network.findFirst({ where: { name: "Pathways to Change" } });
        if (!network) {
          throw new Error("Pathways network required");
        }
        await tx.invitation.create({
          data: {
            id: invitationId,
            emailLookup: hmacEmailLookup(`${MARKER}-invite@example.com`),
            emailEncrypted: encryptPii(`${MARKER}-invite@example.com`),
            tokenHash: Buffer.from(randomUUID().replaceAll("-", ""), "hex"),
            inviterId: admin.id,
            networkId: network.id,
            firstNameEncrypted: encryptPii("Invite"),
            lastNameEncrypted: encryptPii("Eee"),
            status: "pending",
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });
        return users;
      },
    );
    expect(result).toHaveLength(1);
    expect(await migrator.docAffiliation.findUnique({ where: { id: affiliationId } })).not.toBeNull();
    expect(await migrator.invitation.findUnique({ where: { id: invitationId } })).not.toBeNull();
  });

  it("invite_lookup can insert an active member-shaped user and rejects admin_role", async () => {
    const okId = randomUUID();
    const badId = randomUUID();
    createdUserIds.push(okId);
    await withRls({ authMode: "invite_lookup" }, async (tx) => {
      await insertUserRaw(tx, {
        id: okId,
        email: `${MARKER}-invited@example.com`,
        status: "active",
        programRole: "pathways",
        adminRole: "none",
      });
    });
    expect((await migrator.user.findUnique({ where: { id: okId } }))?.status).toBe("active");

    await expect(
      withRls({ authMode: "invite_lookup" }, async (tx) => {
        await insertUserRaw(tx, {
          id: badId,
          email: `${MARKER}-invited-admin@example.com`,
          status: "active",
          programRole: "pathways",
          adminRole: "admin",
        });
      }),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("amend_app cannot DELETE affiliations", async () => {
    const row = await migrator.docAffiliation.create({
      data: { id: randomUUID(), label: `${MARKER}-del`, active: true },
    });
    createdAffiliationIds.push(row.id);
    const admin = await seedUser("admin@local");
    await expect(
      withRls(
        {
          userId: admin.id,
          programRole: admin.programRole,
          adminRole: admin.adminRole,
          status: admin.status,
        },
        async (tx) => {
          await tx.docAffiliation.delete({ where: { id: row.id } });
        },
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("pathways and pending cannot SELECT invitations or INSERT affiliations", async () => {
    const pathways = await seedUser("pathways@local");
    const pending = await seedUser("pending@local");
    const pathwaysSeen = await withRls(
      {
        userId: pathways.id,
        programRole: pathways.programRole,
        adminRole: pathways.adminRole,
        status: pathways.status,
      },
      async (tx) => tx.invitation.findMany(),
    );
    const pendingSeen = await withRls(
      {
        userId: pending.id,
        programRole: pending.programRole,
        adminRole: pending.adminRole,
        status: pending.status,
      },
      async (tx) => tx.invitation.findMany(),
    );
    expect(pathwaysSeen).toHaveLength(0);
    expect(pendingSeen).toHaveLength(0);
    await expect(
      withRls(
        {
          userId: pathways.id,
          programRole: pathways.programRole,
          adminRole: pathways.adminRole,
          status: pathways.status,
        },
        async (tx) => {
          await tx.docAffiliation.create({
            data: { label: `${MARKER}-path`, active: true },
          });
        },
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("empty GUCs cannot expire invitations (sweep operator GUC is required)", async () => {
    const admin = await seedUser("admin@local");
    const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
    if (!network) {
      throw new Error("Pathways network required");
    }
    const invitationId = randomUUID();
    createdInvitationIds.push(invitationId);
    await migrator.invitation.create({
      data: {
        id: invitationId,
        emailLookup: hmacEmailLookup(`${MARKER}-guc@example.com`),
        emailEncrypted: encryptPii(`${MARKER}-guc@example.com`),
        tokenHash: Buffer.from(randomUUID().replaceAll("-", ""), "hex"),
        inviterId: admin.id,
        networkId: network.id,
        firstNameEncrypted: encryptPii("Guc"),
        lastNameEncrypted: encryptPii("Check"),
        status: "pending",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    const visible = await withRls({}, async (tx) => tx.invitation.findMany({ where: { id: invitationId } }));
    expect(visible).toHaveLength(0);
    await withRls({}, async (tx) => {
      await tx.invitation.updateMany({
        where: { id: invitationId },
        data: { status: "expired" },
      });
    });
    expect((await migrator.invitation.findUnique({ where: { id: invitationId } }))?.status).toBe("pending");
  });
});
