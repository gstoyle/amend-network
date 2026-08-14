import "dotenv/config";

process.env.PII_ENCRYPTION_KEY ??= "a".repeat(64);
process.env.EMAIL_LOOKUP_KEY ??= "b".repeat(64);
process.env.AUTH_SECRET ??= "test-auth-secret-at-least-32-chars!";
process.env.DATABASE_URL ??= "postgresql://amend_app:test@127.0.0.1:5432/amend";
process.env.DATABASE_URL_MIGRATE ??=
  "postgresql://amend_owner:test@127.0.0.1:5432/amend";
process.env.SEED_PASSWORD ??= "seed-password-12";
process.env.EMAIL_TRANSPORT ??= "json";
