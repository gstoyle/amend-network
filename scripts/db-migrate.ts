import 'dotenv/config';
import { spawn } from "node:child_process";

const migrateUrl = process.env.DATABASE_URL_MIGRATE;
if (!migrateUrl) {
  throw new Error("DATABASE_URL_MIGRATE is required for migrations");
}

const child = spawn("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: migrateUrl,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
