import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { ProgramRole, SessionClaims } from "@/lib/auth/types";
import { decryptPii, encryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { sendLifecycleEmail } from "@/lib/email/transport";
import { env } from "@/lib/env";

const MANAGER_ROLES = ["admin", "super_admin"] as const;
const NO_LONGER_PENDING = "This registration is no longer pending.";

export type PendingRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  docAffiliationLabel: string;
  networkId: string | null;
  networkName: string;
  submittedAt: string;
  registrationIp: string;
};

export type ApprovalWriteOptions = {
  ip: string;
  userAgent: string;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

export type DecisionResult = { ok: true } | { ok: false; error: string };

class NoLongerPendingError extends Error {
  constructor() {
    super(NO_LONGER_PENDING);
    this.name = "NoLongerPendingError";
  }
}

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

function authorizeManager(
  session: SessionClaims | null,
  options: Pick<ApprovalWriteOptions, "clientAdminRole" | "clientMfaSatisfied"> = {},
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
      throw new Error("invalid_network");
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function decryptOptional(value: Uint8Array | null | undefined): string {
  if (!value) {
    return "";
  }
  return decryptPii(value);
}

export async function listPendingRegistrations(
  session: SessionClaims | null,
  options: Pick<ApprovalWriteOptions, "clientAdminRole" | "clientMfaSatisfied"> & {
    networkId?: string;
  } = {},
): Promise<PendingRegistration[]> {
  const authorized = authorizeManager(session, options);
  const networkFilter = options.networkId ? z.string().uuid().safeParse(options.networkId) : null;
  if (networkFilter && !networkFilter.success) {
    return [];
  }

  return withRls(
    {
      userId: authorized.userId,
      programRole: authorized.programRole,
      adminRole: authorized.adminRole,
      status: authorized.status,
    },
    async (tx) => {
      const [rows, affiliations] = await Promise.all([
        tx.user.findMany({
          where: {
            status: "pending",
            ...(networkFilter?.success ? { networkId: networkFilter.data } : {}),
          },
          orderBy: { createdAt: "asc" },
          include: { network: true },
        }),
        tx.docAffiliation.findMany({ select: { id: true, label: true } }),
      ]);
      const labels = new Map(affiliations.map((row) => [row.id, row.label]));
      return rows.map((row) => {
        const affiliationId = decryptOptional(row.docAffiliationIdEncrypted);
        return {
          id: row.id,
          firstName: decryptOptional(row.firstNameEncrypted),
          lastName: decryptOptional(row.lastNameEncrypted),
          title: decryptOptional(row.titleEncrypted),
          email: decryptPii(row.emailEncrypted),
          docAffiliationLabel: labels.get(affiliationId) ?? "unavailable",
          networkId: row.networkId,
          networkName: row.network?.name ?? "unavailable",
          submittedAt: row.createdAt.toISOString(),
          registrationIp: row.registrationIp ?? "unavailable",
        };
      });
    },
  );
}

export async function approveRegistration(
  session: SessionClaims | null,
  input: ApprovalWriteOptions & { userId: string; networkId?: string },
): Promise<DecisionResult> {
  const authorized = authorizeManager(session, input);
  const userId = z.string().uuid().parse(input.userId);
  const override = input.networkId ? z.string().uuid().parse(input.networkId) : undefined;
  const userAgent = input.userAgent.slice(0, 512);

  let email = "";
  let hasPassword = false;
  try {
    await withRls(
      {
        userId: authorized.userId,
        programRole: authorized.programRole,
        adminRole: authorized.adminRole,
        status: authorized.status,
      },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.status !== "pending") {
          throw new NoLongerPendingError();
        }
        const networkId = override ?? user.networkId;
        if (!networkId) {
          throw new NoLongerPendingError();
        }
        const network = await tx.network.findUnique({ where: { id: networkId } });
        if (!network) {
          throw new NoLongerPendingError();
        }
        const programRole = assignedProgramRole(network.programRole);
        const updated = await tx.user.updateMany({
          where: { id: userId, status: "pending" },
          data: { status: "active", programRole, networkId: network.id },
        });
        if (updated.count !== 1) {
          throw new NoLongerPendingError();
        }
        await writeAudit(tx, {
          actorUserId: authorized.userId,
          actorRole: actorRole(authorized),
          action: "registration_approved",
          entityType: "user",
          entityId: userId,
          targetUserId: userId,
          ip: input.ip,
          userAgent,
          severity: "info",
        });
        await writeAudit(tx, {
          actorUserId: authorized.userId,
          actorRole: actorRole(authorized),
          action: "role_assigned",
          entityType: "user",
          entityId: userId,
          targetUserId: userId,
          ip: input.ip,
          userAgent,
          metadata: { program_role: programRole },
          severity: "info",
        });
        email = decryptPii(user.emailEncrypted);
        hasPassword = user.passwordHash.length > 0;
      },
    );
  } catch (error) {
    if (error instanceof NoLongerPendingError) {
      return { ok: false, error: NO_LONGER_PENDING };
    }
    throw error;
  }

  if (hasPassword) {
    await sendLifecycleEmail({ kind: "welcome", to: email });
  } else {
    const baseUrl = env().AUTH_URL ?? "http://127.0.0.1:3000";
    await sendLifecycleEmail({
      kind: "set_password",
      to: email,
      vars: { link: `${baseUrl}/forgot-password` },
    });
  }
  return { ok: true };
}

export async function denyRegistration(
  session: SessionClaims | null,
  input: ApprovalWriteOptions & { userId: string; reason?: string },
): Promise<DecisionResult> {
  const authorized = authorizeManager(session, input);
  const userId = z.string().uuid().parse(input.userId);
  const reason = input.reason?.trim() ?? "";
  const userAgent = input.userAgent.slice(0, 512);

  let email = "";
  try {
    await withRls(
      {
        userId: authorized.userId,
        programRole: authorized.programRole,
        adminRole: authorized.adminRole,
        status: authorized.status,
      },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.status !== "pending") {
          throw new NoLongerPendingError();
        }
        const updated = await tx.user.updateMany({
          where: { id: userId, status: "pending" },
          data: {
            status: "denied",
            ...(reason.length > 0
              ? { denialReasonEncrypted: Buffer.from(encryptPii(reason)) }
              : {}),
          },
        });
        if (updated.count !== 1) {
          throw new NoLongerPendingError();
        }
        await writeAudit(tx, {
          actorUserId: authorized.userId,
          actorRole: actorRole(authorized),
          action: "registration_denied",
          entityType: "user",
          entityId: userId,
          targetUserId: userId,
          ip: input.ip,
          userAgent,
          metadata: { has_reason: reason.length > 0 },
          severity: "info",
        });
        email = decryptPii(user.emailEncrypted);
      },
    );
  } catch (error) {
    if (error instanceof NoLongerPendingError) {
      return { ok: false, error: NO_LONGER_PENDING };
    }
    throw error;
  }

  await sendLifecycleEmail({ kind: "registration_denied", to: email });
  return { ok: true };
}
