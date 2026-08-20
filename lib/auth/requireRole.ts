import { ADMIN_MFA_REQUIRED } from "@/lib/auth/admin-mfa";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import type { AdminRole, ProgramRole, SessionClaims, UserStatus } from "@/lib/auth/types";

export class AuthDeniedError extends Error {
  constructor() {
    super(AUTH_FAILURE_MESSAGE);
    this.name = "AuthDeniedError";
  }
}

export type RequireRoleOptions = {
  program?: ProgramRole | ProgramRole[];
  admin?: AdminRole | AdminRole[];
  statuses?: UserStatus[];
  mfa?: boolean;
  clientProgramRole?: unknown;
  clientAdminRole?: unknown;
  clientMfaSatisfied?: unknown;
};

function asList<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function isPendingSession(session: SessionClaims | null): boolean {
  return session?.status === "pending";
}

export function requireRole(
  session: SessionClaims | null,
  options: RequireRoleOptions = {},
): SessionClaims {
  void options.clientProgramRole;
  void options.clientAdminRole;
  void options.clientMfaSatisfied;

  if (!session) {
    throw new AuthDeniedError();
  }

  const statuses = options.statuses ?? ["active"];
  if (!statuses.includes(session.status)) {
    throw new AuthDeniedError();
  }

  if (ADMIN_MFA_REQUIRED && options.mfa && !session.mfaSatisfied) {
    throw new AuthDeniedError();
  }

  if (options.program) {
    const allowed = asList(options.program);
    if (!allowed.includes(session.programRole)) {
      throw new AuthDeniedError();
    }
  }

  if (options.admin) {
    const allowed = asList(options.admin);
    if (!allowed.includes(session.adminRole)) {
      throw new AuthDeniedError();
    }
  }

  return session;
}
