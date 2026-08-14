import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { insertSession } from "@/lib/auth/session";
import type { AdminRole, ProgramRole, UserStatus } from "@/lib/auth/types";
import { hmacEmailLookup } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";

const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const IP_PATTERN = /^[0-9a-fA-F.:]+$/;

export type AuthorizeInput = {
  email: string;
  password: string;
  ip: string;
  userAgent: string;
};

export type AuthorizedUser = {
  sessionId: string;
  userId: string;
  programRole: ProgramRole;
  adminRole: AdminRole;
  status: UserStatus;
  mfaEnabled: boolean;
};

let dummyPasswordHash: string | undefined;

async function verifyDummy(plain: string): Promise<boolean> {
  dummyPasswordHash ??= await hashPassword("timing-oracle-dummy-password");
  return verifyPassword(dummyPasswordHash, plain);
}

export function sanitizeIp(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length > 0 && trimmed.length <= 45 && IP_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return "127.0.0.1";
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return sanitizeIp(forwarded || headers.get("x-real-ip") || "127.0.0.1");
}

function snapshotRole(user: { programRole: string; adminRole: string }): string {
  return user.adminRole !== "none" ? user.adminRole : user.programRole;
}

export async function authorizeCredentials(
  input: AuthorizeInput,
): Promise<AuthorizedUser | null> {
  const parsed = credentialsSchema.safeParse({
    email: input.email,
    password: input.password,
  });
  const email = parsed.success ? parsed.data.email : "";
  const password = parsed.success ? parsed.data.password : "";
  const ip = sanitizeIp(input.ip);
  const userAgent = input.userAgent.slice(0, 512);

  const user = await withRls({ authMode: "credential_lookup" }, async (tx) =>
    email
      ? tx.user.findUnique({ where: { emailLookup: hmacEmailLookup(email) } })
      : null,
  );

  const passwordOk = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyDummy(password);

  const deniedStatus = user ? statusBlocksSignIn(user.status) : false;

  if (!user || !passwordOk || deniedStatus) {
    await withRls({}, async (tx) => {
      await writeAudit(tx, {
        actorUserId: user?.id ?? null,
        actorRole: user ? snapshotRole(user) : "anonymous",
        action: "login_failure",
        ip,
        userAgent,
        severity: "warning",
      });
    });
    return null;
  }

  return withRls({ userId: user.id }, async (tx) => {
    const session = await insertSession(tx, {
      userId: user.id,
      ip,
      userAgent,
      programRole: user.programRole,
      adminRole: user.adminRole,
      status: user.status,
    });

    await writeAudit(tx, {
      actorUserId: user.id,
      actorRole: snapshotRole(user),
      action: "login_success",
      entityType: "session",
      entityId: session.sessionId,
      ip,
      userAgent,
      severity: "info",
    });

    return {
      sessionId: session.sessionId,
      userId: user.id,
      programRole: user.programRole,
      adminRole: user.adminRole,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
    };
  });
}

function statusBlocksSignIn(status: UserStatus): boolean {
  switch (status) {
    case "denied":
    case "deactivated":
      return true;
    case "active":
    case "pending":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
