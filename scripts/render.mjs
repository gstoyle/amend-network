/**
 * Render host helpers. Not used locally.
 * Commands: copy-standalone | bootstrap | start
 */
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const AMEND_APP_ROLE = "amend_app";

function usage() {
  process.stderr.write("Usage: node scripts/render.mjs <copy-standalone|bootstrap|start>\n");
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    process.stderr.write(`${name} is required\n`);
    process.exit(1);
  }
  return value;
}

function databaseNameFromUrl(url) {
  const normalized = url.replace(/^postgres(ql)?:/i, "http:");
  let pathname;
  try {
    pathname = new URL(normalized).pathname;
  } catch {
    process.stderr.write("DATABASE_URL_MIGRATE is not a valid URL\n");
    process.exit(1);
  }
  const name = decodeURIComponent(pathname.replace(/^\//, "").split("/")[0] ?? "");
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    process.stderr.write("database name in DATABASE_URL_MIGRATE is not a simple identifier\n");
    process.exit(1);
  }
  return name;
}

function databaseUrlWithRole(url, user, password) {
  const rewritten = url.replace(
    /^(postgres(?:ql)?:\/\/)([^:/?#]+):([^@]+)@/i,
    (_, protocol) => `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(password)}@`,
  );
  if (rewritten === url) {
    process.stderr.write("could not rewrite database URL for amend_app\n");
    process.exit(1);
  }
  return rewritten;
}

function sqlQuote(value) {
  return value.replaceAll("'", "''");
}

function copyStandalone() {
  if (!existsSync(join(".next", "standalone", "server.js"))) {
    process.stderr.write("missing .next/standalone/server.js; did next build run with output: standalone?\n");
    process.exit(1);
  }
  mkdirSync(join(".next", "standalone", ".next"), { recursive: true });
  cpSync(join(".next", "static"), join(".next", "standalone", ".next", "static"), {
    recursive: true,
  });
  if (existsSync("public")) {
    cpSync("public", join(".next", "standalone", "public"), { recursive: true });
  }
}

async function bootstrap() {
  const migrateUrl = requireEnv("DATABASE_URL_MIGRATE");
  const appPassword = requireEnv("AMEND_APP_PASSWORD");
  const databaseName = databaseNameFromUrl(migrateUrl);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    datasources: { db: { url: migrateUrl } },
  });

  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await prisma.$executeRawUnsafe(`
      DO $body$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${AMEND_APP_ROLE}') THEN
          CREATE ROLE ${AMEND_APP_ROLE} LOGIN PASSWORD '${sqlQuote(appPassword)}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        ELSE
          ALTER ROLE ${AMEND_APP_ROLE} LOGIN PASSWORD '${sqlQuote(appPassword)}';
        END IF;
      END
      $body$;
    `);
    await prisma.$executeRawUnsafe(
      `GRANT CONNECT ON DATABASE "${databaseName}" TO ${AMEND_APP_ROLE}`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${AMEND_APP_ROLE}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "bootstrap failed";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  const migrate = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: migrateUrl },
  });
  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }
}

function start() {
  const migrateUrl = requireEnv("DATABASE_URL_MIGRATE");
  const appPassword = requireEnv("AMEND_APP_PASSWORD");
  process.env.HOSTNAME = "0.0.0.0";
  process.env.DATABASE_URL = databaseUrlWithRole(migrateUrl, AMEND_APP_ROLE, appPassword);

  const standaloneDir = join(process.cwd(), ".next", "standalone");
  const server = join(standaloneDir, "server.js");
  if (!existsSync(server)) {
    process.stderr.write("missing .next/standalone/server.js\n");
    process.exit(1);
  }

  const child = spawn(process.execPath, [server], {
    stdio: "inherit",
    cwd: standaloneDir,
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

const command = process.argv[2];
switch (command) {
  case "copy-standalone":
    copyStandalone();
    break;
  case "bootstrap":
    await bootstrap();
    break;
  case "start":
    start();
    break;
  default:
    usage();
}
