import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

export const migrator = new PrismaClient({
  datasources: {
    db: { url: env().DATABASE_URL_MIGRATE },
  },
});
