import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type RlsContext = {
  userId?: string;
  programRole?: string;
  adminRole?: string;
  status?: string;
  authMode?: "credential_check" | "";
};

export async function withRls<T>(
  ctx: RlsContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${ctx.userId ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.program_role', ${ctx.programRole ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.admin_role', ${ctx.adminRole ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.status', ${ctx.status ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.auth_mode', ${ctx.authMode ?? ""}, true)`;
    return fn(tx);
  });
}
