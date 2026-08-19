import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

const MARKER = `retention-policies-${randomUUID()}`;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const AUTH_MODE_LITERAL = /authMode:\s*["']retention["']/;
const SCAN_ROOTS = ["lib", "app", "scripts"] as const;

function isRlsDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /row-level security policy|permission denied/i.test(message);
}

type AppGucs = {
  adminRole?: string;
  programRole?: string;
  status?: string;
  userId?: string;
  authMode?: string;
};

async function asAmendApp<T>(gucs: AppGucs, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${gucs.userId ?? NIL_UUID}, true)`;
    await tx.$executeRaw`SELECT set_config('app.program_role', ${gucs.programRole ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.admin_role', ${gucs.adminRole ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.status', ${gucs.status ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.auth_mode', ${gucs.authMode ?? ""}, true)`;
    return fn(tx as unknown as typeof prisma);
  });
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function productionRetentionAuthModeHits(): { rel: string; count: number }[] {
  const root = process.cwd();
  const hits: { rel: string; count: number }[] = [];
  for (const folder of SCAN_ROOTS) {
    const abs = join(root, folder);
    try {
      statSync(abs);
    } catch {
      continue;
    }
    for (const file of walkTsFiles(abs)) {
      const source = readFileSync(file, "utf8");
      const count = source.match(new RegExp(AUTH_MODE_LITERAL, "g"))?.length ?? 0;
      if (count > 0) {
        hits.push({ rel: relative(root, file).replaceAll("\\", "/"), count });
      }
    }
  }
  return hits;
}

async function insertDeactivatedUser(id: string, email: string): Promise<void> {
  const passwordHash = await hashPassword(env().SEED_PASSWORD);
  await migrator.$executeRaw`
    INSERT INTO users (
      id, email_lookup, email_encrypted, password_hash,
      first_name_encrypted, last_name_encrypted,
      program_role, admin_role, status, updated_at
    ) VALUES (
      ${id}::uuid,
      ${Buffer.from(hmacEmailLookup(email))},
      ${Buffer.from(encryptPii(email))},
      ${passwordHash},
      ${Buffer.from(encryptPii("Keep"))},
      ${Buffer.from(encryptPii("Name"))},
      'pathways'::"ProgramRole",
      'none'::"AdminRole",
      'deactivated'::"UserStatus",
      CURRENT_TIMESTAMP
    )
  `;
}

async function insertAuditSecurityRow(): Promise<bigint> {
  const rows = await migrator.$queryRaw<Array<{ id: bigint }>>`
    INSERT INTO audit_log (
      actor_role, action, ip, user_agent, metadata, severity, created_at
    ) VALUES (
      'system',
      'login_success',
      '127.0.0.1'::inet,
      ${MARKER},
      '{}'::jsonb,
      'security'::"AuditSeverity",
      CURRENT_TIMESTAMP - INTERVAL '8 years'
    )
    RETURNING id
  `;
  return rows[0].id;
}

async function insertInvitation(status: "pending" | "expired"): Promise<string> {
  const admin = await migrator.user.findUnique({ where: { emailLookup: hmacEmailLookup("admin@local") } });
  const network = await migrator.network.findFirst({ where: { name: "Pathways to Change" } });
  if (!admin || !network) {
    throw new Error("seed admin@local and Pathways to Change are required");
  }
  const id = randomUUID();
  await migrator.invitation.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(`${MARKER}-${status}@example.com`),
      emailEncrypted: encryptPii(`${MARKER}-${status}@example.com`),
      tokenHash: Buffer.from(randomUUID().replaceAll("-", ""), "hex"),
      inviterId: admin.id,
      networkId: network.id,
      firstNameEncrypted: encryptPii("Ret"),
      lastNameEncrypted: encryptPii("Ain"),
      status,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
  return id;
}

describe("retention RLS (GUCs only, no requireRole, no runRetentionJob) — contracts/rls-policies.md", () => {
  const userIds: string[] = [];
  const invitationIds: string[] = [];
  const auditIds: bigint[] = [];

  afterEach(async () => {
    if (auditIds.length > 0) {
      await migrator.$executeRaw`DELETE FROM audit_log WHERE id = ANY(${auditIds}::bigint[])`;
      auditIds.length = 0;
    }
    if (invitationIds.length > 0) {
      await migrator.invitation.deleteMany({ where: { id: { in: invitationIds } } });
      invitationIds.length = 0;
    }
    if (userIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: userIds } } });
      userIds.length = 0;
    }
  });

  it("1. Pathways cannot DELETE audit_log or invitations", async () => {
    const auditId = await insertAuditSecurityRow();
    auditIds.push(auditId);
    const invitationId = await insertInvitation("pending");
    invitationIds.push(invitationId);

    const auditDeleted = await asAmendApp(
      { programRole: "pathways", status: "active" },
      async (tx) => tx.$executeRaw`DELETE FROM audit_log WHERE id = ${auditId}`,
    );
    const invitesDeleted = await asAmendApp(
      { programRole: "pathways", status: "active" },
      async (tx) => tx.$executeRaw`DELETE FROM invitations WHERE id = ${invitationId}::uuid`,
    );

    expect(auditDeleted).toBe(0);
    expect(invitesDeleted).toBe(0);
    expect(
      await migrator.auditLog.findUnique({ where: { id: auditId } }),
    ).not.toBeNull();
    expect(
      await migrator.invitation.findUnique({ where: { id: invitationId } }),
    ).not.toBeNull();
  });

  it("2. Admin without retention cannot DELETE audit_log or UPDATE deactivated ciphertext", async () => {
    const auditId = await insertAuditSecurityRow();
    auditIds.push(auditId);
    const userId = randomUUID();
    userIds.push(userId);
    await insertDeactivatedUser(userId, `${MARKER}-admin-no-mode@example.com`);
    const replacement = Buffer.from(encryptPii("Nope"));

    const auditDeleted = await asAmendApp({ adminRole: "admin", status: "active" }, async (tx) =>
      tx.$executeRaw`DELETE FROM audit_log WHERE id = ${auditId}`,
    );
    const updated = await asAmendApp({ adminRole: "admin", status: "active" }, async (tx) =>
      tx.$executeRaw`
        UPDATE users
        SET first_name_encrypted = ${replacement}
        WHERE id = ${userId}::uuid AND status = 'deactivated'
      `,
    );

    expect(auditDeleted).toBe(0);
    expect(updated).toBe(0);
  });

  it("3. Admin with retention cannot UPDATE deactivated users to active (security DELETE is allowed)", async () => {
    const auditId = await insertAuditSecurityRow();
    auditIds.push(auditId);
    const userId = randomUUID();
    userIds.push(userId);
    await insertDeactivatedUser(userId, `${MARKER}-no-reactivate@example.com`);

    const auditDeleted = await asAmendApp(
      { adminRole: "admin", status: "active", authMode: "retention" },
      async (tx) => tx.$executeRaw`DELETE FROM audit_log WHERE id = ${auditId}`,
    );
    expect(auditDeleted).toBe(1);

    await expect(
      asAmendApp({ adminRole: "admin", status: "active", authMode: "retention" }, async (tx) =>
        tx.$executeRaw`
          UPDATE users SET status = 'active'::"UserStatus"
          WHERE id = ${userId}::uuid AND status = 'deactivated'
        `,
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("4. Admin with retention cannot DELETE a pending invitation", async () => {
    const invitationId = await insertInvitation("pending");
    invitationIds.push(invitationId);

    const deleted = await asAmendApp(
      { adminRole: "admin", status: "active", authMode: "retention" },
      async (tx) => tx.$executeRaw`DELETE FROM invitations WHERE id = ${invitationId}::uuid`,
    );

    expect(deleted).toBe(0);
    expect(await migrator.invitation.findUnique({ where: { id: invitationId } })).not.toBeNull();
  });

  it("5. Admin with retention can UPDATE deactivated ciphertext while status stays deactivated", async () => {
    const userId = randomUUID();
    userIds.push(userId);
    await insertDeactivatedUser(userId, `${MARKER}-anonymize@example.com`);
    const replacement = Buffer.from(encryptPii("Anon"));

    const updated = await asAmendApp(
      { adminRole: "admin", status: "active", authMode: "retention" },
      async (tx) =>
        tx.$executeRaw`
          UPDATE users
          SET first_name_encrypted = ${replacement}
          WHERE id = ${userId}::uuid AND status = 'deactivated'
        `,
    );

    expect(updated).toBe(1);
    const row = await migrator.user.findUnique({ where: { id: userId } });
    expect(row?.status).toBe("deactivated");
  });

  it("6. authMode: \"retention\" has exactly one production call site in runRetentionJob", async () => {
    const hits = productionRetentionAuthModeHits();
    expect(hits).toEqual([{ rel: "lib/retention/run.ts", count: 1 }]);
    const source = readFileSync(join(process.cwd(), "lib/retention/run.ts"), "utf8");
    expect(source).toMatch(/export async function runRetentionJob/);
    expect(source).toMatch(AUTH_MODE_LITERAL);
  });
});
