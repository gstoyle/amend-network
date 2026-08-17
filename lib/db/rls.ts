import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export type RlsContext = {
  userId?: string;
  programRole?: string;
  adminRole?: string;
  status?: string;
  authMode?:
    | "credential_lookup"
    | "session_lookup"
    | "throttle"
    | "password_reset"
    | "registration"
    | "invite_lookup"
    | "resource_download"
    | "";
};

export async function withRls<T>(
  ctx: RlsContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const userId = ctx.userId && ctx.userId.length > 0 ? ctx.userId : NIL_UUID;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.program_role', ${ctx.programRole ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.admin_role', ${ctx.adminRole ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.status', ${ctx.status ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.auth_mode', ${ctx.authMode ?? ""}, true)`;
    return fn(tx);
  });
}

/** Bind status/role GUCs to the loaded row so own-row UPDATE WITH CHECK can succeed. */
export async function bindRlsRoleSnapshot(
  tx: Prisma.TransactionClient,
  user: { status: string; programRole: string; adminRole: string },
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.status', ${user.status}, true)`;
  await tx.$executeRaw`SELECT set_config('app.program_role', ${user.programRole}, true)`;
  await tx.$executeRaw`SELECT set_config('app.admin_role', ${user.adminRole}, true)`;
}
