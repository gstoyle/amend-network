import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";

export function retentionSentinelEmail(userId: string): string {
  return `anonymized.${userId}@retention.invalid`;
}

export async function buildAnonymizedUserPatch(userId: string): Promise<{
  passwordHash: string;
  firstNameEncrypted: Uint8Array<ArrayBuffer>;
  lastNameEncrypted: Uint8Array<ArrayBuffer>;
  titleEncrypted: Uint8Array<ArrayBuffer>;
  docAffiliationIdEncrypted: Uint8Array<ArrayBuffer>;
  denialReasonEncrypted: Uint8Array<ArrayBuffer>;
  mfaSecretEncrypted: null;
  mfaEnabled: false;
  registrationIp: null;
  directoryVisible: false;
  directoryShowTitle: false;
  directoryShowDocAffiliation: false;
  directoryShowEmail: false;
  emailLookup: Uint8Array<ArrayBuffer>;
  emailEncrypted: Uint8Array<ArrayBuffer>;
}> {
  const sentinel = retentionSentinelEmail(userId);
  return {
    passwordHash: await hashPassword(randomBytes(32).toString("hex")),
    firstNameEncrypted: encryptPii(""),
    lastNameEncrypted: encryptPii(""),
    titleEncrypted: encryptPii(""),
    docAffiliationIdEncrypted: encryptPii(""),
    denialReasonEncrypted: encryptPii(""),
    mfaSecretEncrypted: null,
    mfaEnabled: false,
    registrationIp: null,
    directoryVisible: false,
    directoryShowTitle: false,
    directoryShowDocAffiliation: false,
    directoryShowEmail: false,
    emailLookup: hmacEmailLookup(sentinel),
    emailEncrypted: encryptPii(sentinel),
  };
}

function utcYearsBefore(now: Date, years: number): Date {
  const value = new Date(now.getTime());
  value.setUTCFullYear(value.getUTCFullYear() - years);
  return value;
}

function inactivityStart(
  user: { lastLoginAt: Date | null; updatedAt: Date },
  deactivatedAt: Date | null,
): Date {
  const parts: Date[] = [];
  if (user.lastLoginAt) {
    parts.push(user.lastLoginAt);
  }
  if (deactivatedAt) {
    parts.push(deactivatedAt);
  }
  if (parts.length === 0) {
    return user.updatedAt;
  }
  return new Date(Math.max(...parts.map((part) => part.getTime())));
}

export async function anonymizeEligibleUsers(
  tx: Prisma.TransactionClient,
  now: Date,
): Promise<number> {
  const cutoff = utcYearsBefore(now, 3);
  const candidates = await tx.user.findMany({
    where: { status: "deactivated" },
    select: {
      id: true,
      emailLookup: true,
      lastLoginAt: true,
      updatedAt: true,
    },
  });
  if (candidates.length === 0) {
    return 0;
  }

  const trails = await tx.auditLog.findMany({
    where: {
      action: "account_deactivated",
      targetUserId: { in: candidates.map((candidate) => candidate.id) },
    },
    select: { targetUserId: true, createdAt: true },
  });
  const latestDeactivated = new Map<string, Date>();
  for (const row of trails) {
    if (!row.targetUserId) {
      continue;
    }
    const previous = latestDeactivated.get(row.targetUserId);
    if (!previous || row.createdAt > previous) {
      latestDeactivated.set(row.targetUserId, row.createdAt);
    }
  }

  const eligibleIds: string[] = [];
  for (const user of candidates) {
    const sentinelLookup = hmacEmailLookup(retentionSentinelEmail(user.id));
    if (Buffer.from(user.emailLookup).equals(Buffer.from(sentinelLookup))) {
      continue;
    }
    const start = inactivityStart(user, latestDeactivated.get(user.id) ?? null);
    if (start <= cutoff) {
      eligibleIds.push(user.id);
    }
  }

  for (const id of eligibleIds) {
    const patch = await buildAnonymizedUserPatch(id);
    await tx.user.update({
      where: { id },
      data: {
        ...patch,
        status: "deactivated",
      },
    });
  }

  if (eligibleIds.length > 0) {
    const userFilter = { userId: { in: eligibleIds } };
    await tx.directoryShownTitle.deleteMany({ where: userFilter });
    await tx.directoryShownDoc.deleteMany({ where: userFilter });
    await tx.directoryShownEmail.deleteMany({ where: userFilter });
    await tx.directoryListing.deleteMany({ where: userFilter });
    await tx.session.deleteMany({ where: userFilter });
    await tx.passwordResetToken.deleteMany({ where: userFilter });
  }

  return eligibleIds.length;
}
