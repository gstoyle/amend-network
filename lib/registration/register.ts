import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/write";
import { hashPassword } from "@/lib/auth/password";
import { sanitizeIp } from "@/lib/auth/credentials";
import { encryptPii, hmacEmailLookup, normalizeEmail } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { sendLifecycleEmail } from "@/lib/email/transport";
import { env } from "@/lib/env";

const LAUNCH_NETWORK_NAMES = ["Pathways to Change", "LEAD"] as const;
const VALIDATION_ERROR = "Check the form and try again.";
const VISITOR_COPY = "If this email is eligible, you will receive instructions.";

export type RegistrationOutcome = "created" | "duplicate";

export type RegisterInput = {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  password: string;
  docAffiliationId: string;
  networkId: string;
  ip: string;
  userAgent: string;
};

export type RegisterResult = { ok: true; message: string } | { ok: false; error: string };

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  email: z.string().trim().min(1).max(254),
  password: z.string().min(12),
  docAffiliationId: z.string().uuid(),
  networkId: z.string().uuid(),
  ip: z.string().min(1),
  userAgent: z.string().min(1),
});

class FormValidationError extends Error {
  constructor() {
    super(VALIDATION_ERROR);
    this.name = "FormValidationError";
  }
}

export function registrationVisitorCopy(outcome?: RegistrationOutcome): string {
  void outcome;
  return VISITOR_COPY;
}

export function isLaunchNetworkName(name: string): boolean {
  return LAUNCH_NETWORK_NAMES.some((allowed) => allowed.toLowerCase() === name.trim().toLowerCase());
}

function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /unique|23505/i.test(message);
}

export async function listLaunchNetworks(): Promise<{ id: string; name: string }[]> {
  return withRls({}, async (tx) => {
    const rows = await tx.network.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return rows.filter((row) => isLaunchNetworkName(row.name));
  });
}

export async function registerSelf(input: RegisterInput): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse({
    ...input,
    userAgent: input.userAgent.slice(0, 512),
  });
  if (!parsed.success) {
    return { ok: false, error: VALIDATION_ERROR };
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(parsed.data.password);
  } catch {
    return { ok: false, error: VALIDATION_ERROR };
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await withRls({ authMode: "credential_lookup" }, async (tx) =>
    tx.user.findUnique({ where: { emailLookup: hmacEmailLookup(email) } }),
  );
  if (existing) {
    return { ok: true, message: registrationVisitorCopy("duplicate") };
  }

  const userId = randomUUID();
  const ip = sanitizeIp(parsed.data.ip);
  try {
    await withRls({ authMode: "registration" }, async (tx) => {
      const affiliation = await tx.docAffiliation.findFirst({
        where: { id: parsed.data.docAffiliationId, active: true },
        select: { id: true },
      });
      const network = await tx.network.findFirst({
        where: { id: parsed.data.networkId },
        select: { id: true, name: true },
      });
      if (!affiliation || !network || !isLaunchNetworkName(network.name)) {
        throw new FormValidationError();
      }

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
          ${Buffer.from(encryptPii(parsed.data.firstName))},
          ${Buffer.from(encryptPii(parsed.data.lastName))},
          ${Buffer.from(encryptPii(parsed.data.title))},
          ${Buffer.from(encryptPii(affiliation.id))},
          'self_registered'::"JoinSource",
          ${ip}::inet,
          ${network.id}::uuid,
          'none'::"ProgramRole",
          'none'::"AdminRole",
          'pending'::"UserStatus",
          CURRENT_TIMESTAMP
        )
      `;
      await writeAudit(tx, {
        actorUserId: userId,
        actorRole: "none",
        action: "registration_submitted",
        entityType: "user",
        entityId: userId,
        ip,
        userAgent: parsed.data.userAgent,
        severity: "info",
      });
    });
  } catch (error) {
    if (error instanceof FormValidationError) {
      return { ok: false, error: VALIDATION_ERROR };
    }
    if (isUniqueViolation(error)) {
      return { ok: true, message: registrationVisitorCopy("duplicate") };
    }
    throw error;
  }

  await sendLifecycleEmail({ kind: "self_registration_confirmation", to: email });
  const adminAlert = env().ADMIN_ALERT_EMAIL;
  if (adminAlert) {
    await sendLifecycleEmail({ kind: "admin_pending_alert", to: adminAlert });
  }
  return { ok: true, message: registrationVisitorCopy("created") };
}
