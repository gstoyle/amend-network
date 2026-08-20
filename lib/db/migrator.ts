import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

const globalForMigrator = globalThis as unknown as { amendMigrator?: PrismaClient };

export const migrator =
  globalForMigrator.amendMigrator ??
  new PrismaClient({
    datasources: {
      db: { url: env().DATABASE_URL_MIGRATE },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForMigrator.amendMigrator = migrator;
}
