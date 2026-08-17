import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

process.env.PII_ENCRYPTION_KEY ??= "a".repeat(64);
process.env.EMAIL_LOOKUP_KEY ??= "b".repeat(64);
process.env.AUTH_SECRET ??= "test-auth-secret-at-least-32-chars!";
process.env.DATABASE_URL ??= "postgresql://amend_app:test@127.0.0.1:5432/amend";
process.env.DATABASE_URL_MIGRATE ??=
  "postgresql://amend_owner:test@127.0.0.1:5432/amend";
process.env.SEED_PASSWORD ??= "seed-password-12";
process.env.EMAIL_TRANSPORT ??= "json";
process.env.EMAIL_JSON_DIR ??= ".tmp/mail";
process.env.ADMIN_ALERT_EMAIL ??= "admins@example.com";
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || "http://127.0.0.1:9000";
process.env.S3_REGION = process.env.S3_REGION || "us-east-1";
process.env.S3_BUCKET = process.env.S3_BUCKET || "amend-resources";
process.env.S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || "minioadmin";
process.env.S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || "minioadmin";
