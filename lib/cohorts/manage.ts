import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import type { AuditAction } from "@/lib/audit/actions";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import type { CohortProgram } from "@/lib/cohorts/list";
import { decryptPii, hmacEmailLookup, normalizeEmail } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";

const MANAGER_ROLES = ["admin", "super_admin"] as const;

export const COHORT_DUPLICATE_NAME = "That name is already in use.";
export const COHORT_NO_ELIGIBLE_MEMBER = "No eligible member with that email.";
export const COHORT_PRIMARY_REMOVAL =
  "This is the member's primary cohort and can't be removed here.";
export const COHORT_ARCHIVED = "This cohort is archived. Unarchive it to add members.";

const idSchema = z.string().uuid();
const nameSchema = z.string().trim().min(1, "Enter a cohort name.").max(80, "Use 80 characters or fewer.");
const programSchema = z.enum(["pathways", "lead"], { message: "Choose a programme." });
const emailSchema = z.string().trim().email(COHORT_NO_ELIGIBLE_MEMBER);

export type CohortWriteOptions = {
  ip: string;
  userAgent: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

type ClientClaims = Pick<CohortWriteOptions, "clientAdminRole" | "clientMfaSatisfied">;

export type CohortAdminRecord = {
  id: string;
  name: string;
  programRole: CohortProgram;
  archived: boolean;
  memberCount: number;
};

export type CohortMemberRecord = {
  userId: string;
  name: string;
  primary: boolean;
  active: boolean;
};

const USER_FACING_ERRORS = new Set([
  COHORT_DUPLICATE_NAME,
  COHORT_NO_ELIGIBLE_MEMBER,
  COHORT_PRIMARY_REMOVAL,
  COHORT_ARCHIVED,
]);

/** Message safe to show the admin, or null when the error should propagate. */
export function cohortErrorMessage(error: unknown): string | null {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? COHORT_NO_ELIGIBLE_MEMBER;
  }
  if (error instanceof Error && USER_FACING_ERRORS.has(error.message)) {
    return error.message;
  }
  return null;
}

function authorizeManager(session: SessionClaims | null, options: ClientClaims): SessionClaims {
  return requireRole(session, {
    admin: [...MANAGER_ROLES],
    mfa: true,
    clientAdminRole: options.clientAdminRole,
    clientMfaSatisfied: options.clientMfaSatisfied,
  });
}

function rlsSession(session: SessionClaims) {
  return {
    userId: session.userId,
    programRole: session.programRole,
    adminRole: session.adminRole,
    status: session.status,
  };
}

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

function toProgram(role: string): CohortProgram {
  if (role === "pathways" || role === "lead") {
    return role;
  }
  throw new Error("networks: unexpected programme");
}

function memberName(first: Uint8Array | null, last: Uint8Array | null): string {
  const name = [first, last]
    .map((value) => (value ? decryptPii(value).trim() : ""))
    .filter(Boolean)
    .join(" ");
  return name || "Member";
}

async function audit(
  tx: Prisma.TransactionClient,
  session: SessionClaims,
  input: {
    action: AuditAction;
    cohortId: string;
    targetUserId?: string;
    ip: string;
    userAgent: string;
  },
): Promise<void> {
  await writeAudit(tx, {
    actorUserId: session.userId,
    actorRole: actorRole(session),
    action: input.action,
    entityType: input.targetUserId ? "cohort_membership" : "cohort",
    entityId: input.cohortId,
    targetUserId: input.targetUserId ?? null,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { cohort_id: input.cohortId },
    severity: "info",
  });
}

async function assertNameFree(
  tx: Prisma.TransactionClient,
  name: string,
  exceptId?: string,
): Promise<void> {
  const clash = await tx.network.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new Error(COHORT_DUPLICATE_NAME);
  }
}

function rethrowDuplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new Error(COHORT_DUPLICATE_NAME);
  }
  throw error;
}

async function loadCohort(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<CohortAdminRecord | null> {
  const row = await tx.network.findFirst({
    where: { id, programRole: { in: ["pathways", "lead"] } },
    select: {
      id: true,
      name: true,
      programRole: true,
      archivedAt: true,
      _count: { select: { memberships: true } },
    },
  });
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    programRole: toProgram(row.programRole),
    archived: row.archivedAt !== null,
    memberCount: row._count.memberships,
  };
}

async function requireCohort(tx: Prisma.TransactionClient, id: string): Promise<CohortAdminRecord> {
  const cohort = await loadCohort(tx, id);
  if (!cohort) {
    throw new Error(COHORT_NO_ELIGIBLE_MEMBER);
  }
  return cohort;
}

export async function listCohortsForAdmin(
  session: SessionClaims | null,
  options: ClientClaims = {},
): Promise<CohortAdminRecord[]> {
  const authorized = authorizeManager(session, options);
  const rows = await withRls(rlsSession(authorized), (tx) =>
    tx.network.findMany({
      where: { programRole: { in: ["pathways", "lead"] } },
      orderBy: [{ programRole: "asc" }, { archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        programRole: true,
        archivedAt: true,
        _count: { select: { memberships: true } },
      },
    }),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    programRole: toProgram(row.programRole),
    archived: row.archivedAt !== null,
    memberCount: row._count.memberships,
  }));
}

export async function getCohortForAdmin(
  session: SessionClaims | null,
  id: string,
  options: ClientClaims = {},
): Promise<{ cohort: CohortAdminRecord; members: CohortMemberRecord[] } | null> {
  const authorized = authorizeManager(session, options);
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return null;
  }
  return withRls(rlsSession(authorized), async (tx) => {
    const cohort = await loadCohort(tx, parsed.data);
    if (!cohort) {
      return null;
    }
    const rows = await tx.userNetwork.findMany({
      where: { networkId: cohort.id },
      select: {
        user: {
          select: {
            id: true,
            networkId: true,
            status: true,
            firstNameEncrypted: true,
            lastNameEncrypted: true,
          },
        },
      },
    });
    const members = rows
      .map(({ user }) => ({
        userId: user.id,
        name: memberName(user.firstNameEncrypted, user.lastNameEncrypted),
        primary: user.networkId === cohort.id,
        active: user.status === "active",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { cohort, members };
  });
}

export async function createCohort(
  session: SessionClaims | null,
  input: CohortWriteOptions & { name: string; programRole: string },
): Promise<CohortAdminRecord> {
  const authorized = authorizeManager(session, input);
  const name = nameSchema.parse(input.name);
  const programRole = programSchema.parse(input.programRole);
  try {
    return await withRls(rlsSession(authorized), async (tx) => {
      await assertNameFree(tx, name);
      const row = await tx.network.create({ data: { name, programRole }, select: { id: true } });
      await audit(tx, authorized, { action: "cohort_created", cohortId: row.id, ip: input.ip, userAgent: input.userAgent });
      return requireCohort(tx, row.id);
    });
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function renameCohort(
  session: SessionClaims | null,
  input: CohortWriteOptions & { id: string; name: string },
): Promise<CohortAdminRecord> {
  const authorized = authorizeManager(session, input);
  const id = idSchema.parse(input.id);
  const name = nameSchema.parse(input.name);
  try {
    return await withRls(rlsSession(authorized), async (tx) => {
      await requireCohort(tx, id);
      await assertNameFree(tx, name, id);
      await tx.network.update({ where: { id }, data: { name }, select: { id: true } });
      await audit(tx, authorized, { action: "cohort_renamed", cohortId: id, ip: input.ip, userAgent: input.userAgent });
      return requireCohort(tx, id);
    });
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function setCohortArchived(
  session: SessionClaims | null,
  input: CohortWriteOptions & { id: string; archived: boolean },
): Promise<CohortAdminRecord> {
  const authorized = authorizeManager(session, input);
  const id = idSchema.parse(input.id);
  return withRls(rlsSession(authorized), async (tx) => {
    const current = await requireCohort(tx, id);
    if (current.archived === input.archived) {
      return current;
    }
    await tx.network.update({
      where: { id },
      data: { archivedAt: input.archived ? new Date() : null },
      select: { id: true },
    });
    await audit(tx, authorized, {
      action: input.archived ? "cohort_archived" : "cohort_unarchived",
      cohortId: id,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return requireCohort(tx, id);
  });
}

export async function addCohortMember(
  session: SessionClaims | null,
  input: CohortWriteOptions & { cohortId: string; email: string },
): Promise<void> {
  const authorized = authorizeManager(session, input);
  const cohortId = idSchema.parse(input.cohortId);
  const parsedEmail = emailSchema.safeParse(input.email);
  if (!parsedEmail.success) {
    throw new Error(COHORT_NO_ELIGIBLE_MEMBER);
  }
  const lookup = hmacEmailLookup(normalizeEmail(parsedEmail.data));
  await withRls(rlsSession(authorized), async (tx) => {
    const cohort = await requireCohort(tx, cohortId);
    if (cohort.archived) {
      throw new Error(COHORT_ARCHIVED);
    }
    const user = await tx.user.findUnique({
      where: { emailLookup: lookup },
      select: { id: true, programRole: true, networkMemberships: { where: { networkId: cohortId } } },
    });
    if (!user || user.programRole === "none" || user.networkMemberships.length > 0) {
      throw new Error(COHORT_NO_ELIGIBLE_MEMBER);
    }
    await tx.userNetwork.create({ data: { userId: user.id, networkId: cohortId } });
    await audit(tx, authorized, {
      action: "cohort_member_added",
      cohortId,
      targetUserId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  });
}

export async function removeCohortMember(
  session: SessionClaims | null,
  input: CohortWriteOptions & { cohortId: string; userId: string },
): Promise<void> {
  const authorized = authorizeManager(session, input);
  const cohortId = idSchema.parse(input.cohortId);
  const userId = idSchema.parse(input.userId);
  await withRls(rlsSession(authorized), async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { networkId: true } });
    if (user?.networkId === cohortId) {
      throw new Error(COHORT_PRIMARY_REMOVAL);
    }
    const removed = await tx.userNetwork.deleteMany({ where: { userId, networkId: cohortId } });
    if (removed.count === 0) {
      throw new Error(COHORT_NO_ELIGIBLE_MEMBER);
    }
    await audit(tx, authorized, {
      action: "cohort_member_removed",
      cohortId,
      targetUserId: userId,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  });
}
