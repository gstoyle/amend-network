import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Next.js HMR re-evaluates this module. Without a process-wide singleton each
 * reload leaves the previous pool open until Postgres has no slots left.
 * Keep the cap small: this app is a single Node process, not a connection farm.
 */
function urlWithPool(url: string): string {
  const joiner = url.includes("?") ? "&" : "?";
  const extra: string[] = [];
  if (!/[?&]connection_limit=/.test(url)) {
    extra.push("connection_limit=5");
  }
  if (!/[?&]pool_timeout=/.test(url)) {
    extra.push("pool_timeout=10");
  }
  return extra.length === 0 ? url : `${url}${joiner}${extra.join("&")}`;
}

function createClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: { url: urlWithPool(env().DATABASE_URL) },
    },
  });
}

const globalForPrisma = globalThis as unknown as { amendPrisma?: PrismaClient };

export const prisma = globalForPrisma.amendPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.amendPrisma = prisma;
}
