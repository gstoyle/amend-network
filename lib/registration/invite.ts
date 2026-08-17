import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { sanitizeIp } from "@/lib/auth/credentials";
import { hashPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/requireRole";
import type { ProgramRole, SessionClaims } from "@/lib/auth/types";
import { decryptPii, encryptPii, hmacEmailLookup, normalizeEmail } from "@/lib/crypto/pii";
import { hashToken, randomToken } from "@/lib/crypto/token";
import { withRls } from "@/lib/db/rls";
import { sendLifecycleEmail } from "@/lib/email/transport";
import { env } from "@/lib/env";
import { parseInviteCsv } from "@/lib/registration/csv";
import { isLaunchNetworkName } from "@/lib/registration/register";

export const INVITE_TTL_DAYS = 14;
export const INVITE_USED_COPY =
  "This invitation has already been used — please log in or request a password reset.";
export const INVITE_UNUSABLE_COPY = "This invitation is not valid.";
export const INVITE_SIGNED_IN_COPY = "Sign out and open this invitation again to complete registration.";

const MANAGER_ROLES = ["admin", "super_admin"] as const;
const VALIDATION_ERROR = "Check the form and try again.";
const TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

const emailSchema = z
  .string()
  .trim()
  .min(1)
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+$/);
const nameSchema = z.string().trim().min(1).max(80);
const titleSchema = z.string().trim().min(1).max(120);

export type InviteWriteOptions = {
  ip: string;
  userAgent: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

export type ManualInviteInput = InviteWriteOptions & {
  email: string;
  firstName: string;
  lastName: string;
  networkId: string;
  title?: string;
};

export type SendInviteSuccess = { ok: true; invitationId: string; token: string };
export type SendInviteFailure = { ok: false; error: string };
export type SendManualResult = SendInviteSuccess | SendInviteFailure;

export type CsvInviteInvalidRow = { email: string; reason: string };
export type SendCsvResult =
  | { ok: true; sent: SendInviteSuccess[]; invalid: CsvInviteInvalidRow[] }
  | { ok: false; error: "bad_header" | "oversize" };

export type InviteLookup =
  | {
      state: "pending";
      email: string;
      firstName: string;
      lastName: string;
      title: string;
      networkId: string;
      networkName: string;
      docAffiliationId?: string;
    }
  | { state: "used" }
  | { state: "unusable" };

export type CompleteInviteInput = {
  token: string;
  password: string;
  title?: string;
  docAffiliationId?: string;
  ip: string;
  userAgent: string;
  signedIn?: boolean;
};

export type CompleteInviteResult = { ok: true } | { ok: false; error: string };

export type InvitationListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  networkName: string;
  status: "pending" | "expired" | "revoked";
  expiresAt: string;
};

export type InviteLifecycleResult = { ok: true } | { ok: false; error: string };

class FormValidationError extends Error {
  constructor() {
    super(VALIDATION_ERROR);
    this.name = "FormValidationError";
  }
}

class InviteCompleteError extends Error {
  constructor(readonly copy: string) {
    super(copy);
    this.name = "InviteCompleteError";
  }
}

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

function authorizeManager(
  session: SessionClaims | null,
  options: Pick<InviteWriteOptions, "clientAdminRole" | "clientMfaSatisfied"> = {},
): SessionClaims {
  return requireRole(session, {
    admin: [...MANAGER_ROLES],
    mfa: true,
    clientAdminRole: options.clientAdminRole,
    clientMfaSatisfied: options.clientMfaSatisfied,
  });
}

function assignedProgramRole(role: ProgramRole): "pathways" | "lead" {
  switch (role) {
    case "pathways":
    case "lead":
      return role;
    case "none":
      throw new FormValidationError();
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /unique|23505/i.test(message);
}

export function inviteLinkForToken(token: string): string {
  const baseUrl = env().AUTH_URL ?? "http://127.0.0.1:3000";
  return `${baseUrl}/invite/${token}`;
}

export function inviteEmailText(link: string): string {
  return `You have ${INVITE_TTL_DAYS} days to complete registration.\n${link}`;
}

async function deliverInviteEmail(to: string, token: string): Promise<void> {
  const link = inviteLinkForToken(token);
  await sendLifecycleEmail({
    kind: "invite",
    to,
    vars: { link, text: inviteEmailText(link) },
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

type PreparedInvite = {
  email: string;
  firstName: string;
  lastName: string;
  title?: string;
  docAffiliationId?: string;
  networkId: string;
  token: string;
  invitationId: string;
};

async function insertPendingInvitation(
  tx: Prisma.TransactionClient,
  session: SessionClaims,
  row: PreparedInvite,
  ip: string,
  userAgent: string,
): Promise<void> {
  await tx.invitation.create({
    data: {
      id: row.invitationId,
      emailLookup: hmacEmailLookup(row.email),
      emailEncrypted: encryptPii(row.email),
      tokenHash: hashToken(row.token),
      inviterId: session.userId,
      networkId: row.networkId,
      firstNameEncrypted: encryptPii(row.firstName),
      lastNameEncrypted: encryptPii(row.lastName),
      titleEncrypted: row.title ? encryptPii(row.title) : null,
      docAffiliationIdEncrypted: row.docAffiliationId ? encryptPii(row.docAffiliationId) : null,
      status: "pending",
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  await writeAudit(tx, {
    actorUserId: session.userId,
    actorRole: actorRole(session),
    action: "invitation_sent",
    entityType: "invitation",
    entityId: row.invitationId,
    ip,
    userAgent,
    severity: "info",
  });
}

export async function sendManualInvite(
  session: SessionClaims | null,
  input: ManualInviteInput,
): Promise<SendManualResult> {
  const authorized = authorizeManager(session, input);
  const parsed = z
    .object({
      email: emailSchema,
      firstName: nameSchema,
      lastName: nameSchema,
      networkId: z.string().uuid(),
      title: z.string().trim().max(120).optional(),
      ip: z.string().min(1),
      userAgent: z.string().min(1),
    })
    .safeParse({
      ...input,
      title: input.title?.trim() ? input.title : undefined,
      userAgent: input.userAgent.slice(0, 512),
    });
  if (!parsed.success) {
    return { ok: false, error: VALIDATION_ERROR };
  }

  const email = normalizeEmail(parsed.data.email);
  const prepared: PreparedInvite = {
    email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    title: parsed.data.title,
    networkId: parsed.data.networkId,
    token: randomToken(),
    invitationId: randomUUID(),
  };
  const ip = sanitizeIp(parsed.data.ip);

  try {
    await withRls(rlsSession(authorized), async (tx) => {
      const [existingUser, pendingInvite, network] = await Promise.all([
        tx.user.findUnique({ where: { emailLookup: hmacEmailLookup(email) }, select: { id: true } }),
        tx.invitation.findFirst({
          where: { emailLookup: hmacEmailLookup(email), status: "pending" },
          select: { id: true },
        }),
        tx.network.findUnique({ where: { id: parsed.data.networkId }, select: { id: true, name: true } }),
      ]);
      if (existingUser) {
        throw new InviteCompleteError("email_already_a_user");
      }
      if (pendingInvite) {
        throw new InviteCompleteError("pending_invitation");
      }
      if (!network || !isLaunchNetworkName(network.name)) {
        throw new InviteCompleteError("unknown_network");
      }
      await insertPendingInvitation(tx, authorized, prepared, ip, parsed.data.userAgent);
    });
  } catch (error) {
    if (error instanceof InviteCompleteError) {
      return { ok: false, error: error.copy };
    }
    if (isUniqueViolation(error)) {
      return { ok: false, error: "pending_invitation" };
    }
    throw error;
  }

  await deliverInviteEmail(email, prepared.token);
  return { ok: true, invitationId: prepared.invitationId, token: prepared.token };
}

export async function sendCsvInvites(
  session: SessionClaims | null,
  input: InviteWriteOptions & { csvText: string },
): Promise<SendCsvResult> {
  const authorized = authorizeManager(session, input);
  const parsed = parseInviteCsv(input.csvText);
  if (!parsed.ok) {
    return parsed;
  }

  const userAgent = input.userAgent.slice(0, 512);
  const ip = sanitizeIp(input.ip);
  const invalid: CsvInviteInvalidRow[] = [...parsed.invalid];
  const prepared: PreparedInvite[] = [];

  await withRls(rlsSession(authorized), async (tx) => {
    const [networks, affiliations] = await Promise.all([
      tx.network.findMany({ select: { id: true, name: true } }),
      tx.docAffiliation.findMany({ select: { id: true, label: true, active: true } }),
    ]);

    for (const row of parsed.valid) {
      const network = networks.find(
        (candidate) => candidate.name.trim().toLowerCase() === row.networkName.trim().toLowerCase(),
      );
      if (!network || !isLaunchNetworkName(network.name)) {
        invalid.push({ email: row.email, reason: "unknown_network" });
        continue;
      }
      const affiliation = affiliations.find(
        (candidate) => candidate.label.trim().toLowerCase() === row.docAffiliation.trim().toLowerCase(),
      );
      if (!affiliation || !affiliation.active) {
        invalid.push({ email: row.email, reason: "inactive_or_unknown_doc" });
        continue;
      }
      const existingUser = await tx.user.findUnique({
        where: { emailLookup: hmacEmailLookup(row.email) },
        select: { id: true },
      });
      if (existingUser) {
        invalid.push({ email: row.email, reason: "email_already_a_user" });
        continue;
      }
      const pendingInvite = await tx.invitation.findFirst({
        where: { emailLookup: hmacEmailLookup(row.email), status: "pending" },
        select: { id: true },
      });
      if (pendingInvite) {
        invalid.push({ email: row.email, reason: "pending_invitation" });
        continue;
      }

      const item: PreparedInvite = {
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        title: row.title,
        docAffiliationId: affiliation.id,
        networkId: network.id,
        token: randomToken(),
        invitationId: randomUUID(),
      };
      try {
        await insertPendingInvitation(tx, authorized, item, ip, userAgent);
        prepared.push(item);
      } catch (error) {
        if (isUniqueViolation(error)) {
          invalid.push({ email: row.email, reason: "pending_invitation" });
          continue;
        }
        throw error;
      }
    }

    if (prepared.length >= 2) {
      await writeAudit(tx, {
        actorUserId: authorized.userId,
        actorRole: actorRole(authorized),
        action: "bulk_invite_sent",
        entityType: "invitation",
        ip,
        userAgent,
        metadata: { count: prepared.length },
        severity: "info",
      });
    }
  });

  for (const row of prepared) {
    await deliverInviteEmail(row.email, row.token);
  }

  return {
    ok: true,
    sent: prepared.map((row) => ({ ok: true, invitationId: row.invitationId, token: row.token })),
    invalid,
  };
}

function invitationState(
  row: { status: string; expiresAt: Date } | null,
): "pending" | "used" | "unusable" {
  if (!row) {
    return "unusable";
  }
  if (row.status === "accepted") {
    return "used";
  }
  if (row.status !== "pending" || row.expiresAt.getTime() <= Date.now()) {
    return "unusable";
  }
  return "pending";
}

export async function lookupInvite(token: string): Promise<InviteLookup> {
  const tokenHash = hashToken(token);
  return withRls({ authMode: "invite_lookup" }, async (tx) => {
    const row = await tx.invitation.findUnique({
      where: { tokenHash },
      include: { network: true },
    });
    const state = invitationState(row);
    if (state === "used") {
      return { state };
    }
    if (state === "unusable" || !row) {
      return { state: "unusable" };
    }

    let docAffiliationId: string | undefined;
    if (row.docAffiliationIdEncrypted) {
      const id = decryptPii(row.docAffiliationIdEncrypted);
      const active = await tx.docAffiliation.findFirst({
        where: { id, active: true },
        select: { id: true },
      });
      if (active) {
        docAffiliationId = active.id;
      }
    }

    return {
      state: "pending",
      email: decryptPii(row.emailEncrypted),
      firstName: decryptPii(row.firstNameEncrypted),
      lastName: decryptPii(row.lastNameEncrypted),
      title: row.titleEncrypted ? decryptPii(row.titleEncrypted) : "",
      networkId: row.networkId,
      networkName: row.network.name,
      ...(docAffiliationId ? { docAffiliationId } : {}),
    };
  });
}

export async function completeInvite(input: CompleteInviteInput): Promise<CompleteInviteResult> {
  if (input.signedIn) {
    return { ok: false, error: INVITE_SIGNED_IN_COPY };
  }

  const parsed = z
    .object({
      token: z.string().min(1),
      password: z.string().min(12),
      title: z.string().trim().max(120).optional(),
      docAffiliationId: z.string().optional(),
      ip: z.string().min(1),
      userAgent: z.string().min(1),
    })
    .safeParse({
      ...input,
      title: input.title?.trim() ? input.title : undefined,
      docAffiliationId: input.docAffiliationId?.trim() ? input.docAffiliationId : undefined,
      userAgent: input.userAgent.slice(0, 512),
    });
  if (!parsed.success) {
    return { ok: false, error: VALIDATION_ERROR };
  }
  if (parsed.data.docAffiliationId && !z.string().uuid().safeParse(parsed.data.docAffiliationId).success) {
    return { ok: false, error: VALIDATION_ERROR };
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(parsed.data.password);
  } catch {
    return { ok: false, error: VALIDATION_ERROR };
  }

  const tokenHash = hashToken(parsed.data.token);
  const userId = randomUUID();
  const ip = sanitizeIp(parsed.data.ip);

  try {
    await withRls({ authMode: "invite_lookup" }, async (tx) => {
      const row = await tx.invitation.findUnique({
        where: { tokenHash },
        include: { network: true },
      });
      const state = invitationState(row);
      if (state === "used") {
        throw new InviteCompleteError(INVITE_USED_COPY);
      }
      if (state === "unusable" || !row) {
        throw new InviteCompleteError(INVITE_UNUSABLE_COPY);
      }

      const title = parsed.data.title ?? (row.titleEncrypted ? decryptPii(row.titleEncrypted) : "");
      if (!titleSchema.safeParse(title).success) {
        throw new FormValidationError();
      }

      let docId = parsed.data.docAffiliationId;
      if (!docId && row.docAffiliationIdEncrypted) {
        docId = decryptPii(row.docAffiliationIdEncrypted);
      }
      if (!docId || !z.string().uuid().safeParse(docId).success) {
        throw new FormValidationError();
      }
      const affiliation = await tx.docAffiliation.findFirst({
        where: { id: docId, active: true },
        select: { id: true },
      });
      if (!affiliation) {
        throw new FormValidationError();
      }

      const programRole = assignedProgramRole(row.network.programRole);
      const email = decryptPii(row.emailEncrypted);
      const firstName = decryptPii(row.firstNameEncrypted);
      const lastName = decryptPii(row.lastNameEncrypted);

      try {
        await tx.$executeRaw`
          INSERT INTO users (
            id, email_lookup, email_encrypted, password_hash,
            first_name_encrypted, last_name_encrypted, title_encrypted, doc_affiliation_id_encrypted,
            join_source, registration_ip, network_id,
            program_role, admin_role, status, updated_at
          ) VALUES (
            ${userId}::uuid,
            ${Buffer.from(hmacEmailLookup(email))},
            ${Buffer.from(encryptPii(email))},
            ${passwordHash},
            ${Buffer.from(encryptPii(firstName))},
            ${Buffer.from(encryptPii(lastName))},
            ${Buffer.from(encryptPii(title))},
            ${Buffer.from(encryptPii(affiliation.id))},
            'invited'::"JoinSource",
            ${ip}::inet,
            ${row.networkId}::uuid,
            ${programRole}::"ProgramRole",
            'none'::"AdminRole",
            'active'::"UserStatus",
            CURRENT_TIMESTAMP
          )
        `;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new InviteCompleteError(INVITE_UNUSABLE_COPY);
        }
        throw error;
      }

      const updated = await tx.invitation.updateMany({
        where: { id: row.id, status: "pending" },
        data: {
          status: "accepted",
          acceptedUserId: userId,
          acceptedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new InviteCompleteError(INVITE_USED_COPY);
      }

      await writeAudit(tx, {
        actorUserId: userId,
        actorRole: programRole,
        action: "invitation_accepted",
        entityType: "invitation",
        entityId: row.id,
        targetUserId: userId,
        ip,
        userAgent: parsed.data.userAgent,
        severity: "info",
      });
      await writeAudit(tx, {
        actorUserId: userId,
        actorRole: programRole,
        action: "role_assigned",
        entityType: "user",
        entityId: userId,
        targetUserId: userId,
        ip,
        userAgent: parsed.data.userAgent,
        metadata: { program_role: programRole },
        severity: "info",
      });
    });
  } catch (error) {
    if (error instanceof InviteCompleteError) {
      return { ok: false, error: error.copy };
    }
    if (error instanceof FormValidationError) {
      return { ok: false, error: VALIDATION_ERROR };
    }
    throw error;
  }

  return { ok: true };
}

export async function listInvitations(
  session: SessionClaims | null,
  options: Pick<InviteWriteOptions, "clientAdminRole" | "clientMfaSatisfied"> = {},
): Promise<InvitationListItem[]> {
  const authorized = authorizeManager(session, options);
  return withRls(rlsSession(authorized), async (tx) => {
    const rows = await tx.invitation.findMany({
      where: { status: { in: ["pending", "expired", "revoked"] } },
      orderBy: { expiresAt: "asc" },
      include: { network: true },
    });
    return rows.map((row) => {
      const status = row.status;
      switch (status) {
        case "pending":
        case "expired":
        case "revoked":
          return {
            id: row.id,
            email: decryptPii(row.emailEncrypted),
            firstName: decryptPii(row.firstNameEncrypted),
            lastName: decryptPii(row.lastNameEncrypted),
            networkName: row.network.name,
            status,
            expiresAt: row.expiresAt.toISOString(),
          };
        case "accepted":
          throw new Error("accepted invitations are not listed");
        default: {
          const _exhaustive: never = status;
          return _exhaustive;
        }
      }
    });
  });
}

export async function revokeInvite(
  session: SessionClaims | null,
  input: InviteWriteOptions & { invitationId: string },
): Promise<InviteLifecycleResult> {
  const authorized = authorizeManager(session, input);
  const invitationId = z.string().uuid().parse(input.invitationId);
  const userAgent = input.userAgent.slice(0, 512);
  const ip = sanitizeIp(input.ip);

  try {
    await withRls(rlsSession(authorized), async (tx) => {
      const updated = await tx.invitation.updateMany({
        where: { id: invitationId, status: "pending" },
        data: { status: "revoked", revokedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new InviteCompleteError("not_pending");
      }
      await writeAudit(tx, {
        actorUserId: authorized.userId,
        actorRole: actorRole(authorized),
        action: "invitation_revoked",
        entityType: "invitation",
        entityId: invitationId,
        ip,
        userAgent,
        severity: "info",
      });
    });
  } catch (error) {
    if (error instanceof InviteCompleteError) {
      return { ok: false, error: error.copy };
    }
    throw error;
  }
  return { ok: true };
}

export async function reissueInvite(
  session: SessionClaims | null,
  input: InviteWriteOptions & { invitationId: string },
): Promise<SendManualResult> {
  const authorized = authorizeManager(session, input);
  const invitationId = z.string().uuid().parse(input.invitationId);
  const userAgent = input.userAgent.slice(0, 512);
  const ip = sanitizeIp(input.ip);
  const prepared: PreparedInvite = {
    email: "",
    firstName: "",
    lastName: "",
    networkId: "",
    token: randomToken(),
    invitationId: randomUUID(),
  };

  try {
    await withRls(rlsSession(authorized), async (tx) => {
      const source = await tx.invitation.findUnique({ where: { id: invitationId } });
      if (!source || (source.status !== "expired" && source.status !== "revoked")) {
        throw new InviteCompleteError("not_reissuable");
      }
      const email = decryptPii(source.emailEncrypted);
      const existingUser = await tx.user.findUnique({
        where: { emailLookup: source.emailLookup },
        select: { id: true },
      });
      const pendingInvite = await tx.invitation.findFirst({
        where: { emailLookup: source.emailLookup, status: "pending" },
        select: { id: true },
      });
      if (existingUser) {
        throw new InviteCompleteError("email_already_a_user");
      }
      if (pendingInvite) {
        throw new InviteCompleteError("pending_invitation");
      }
      prepared.email = email;
      prepared.firstName = decryptPii(source.firstNameEncrypted);
      prepared.lastName = decryptPii(source.lastNameEncrypted);
      prepared.title = source.titleEncrypted ? decryptPii(source.titleEncrypted) : undefined;
      prepared.docAffiliationId = source.docAffiliationIdEncrypted
        ? decryptPii(source.docAffiliationIdEncrypted)
        : undefined;
      prepared.networkId = source.networkId;
      await insertPendingInvitation(tx, authorized, prepared, ip, userAgent);
    });
  } catch (error) {
    if (error instanceof InviteCompleteError) {
      return { ok: false, error: error.copy };
    }
    if (isUniqueViolation(error)) {
      return { ok: false, error: "pending_invitation" };
    }
    throw error;
  }

  await deliverInviteEmail(prepared.email, prepared.token);
  return { ok: true, invitationId: prepared.invitationId, token: prepared.token };
}
