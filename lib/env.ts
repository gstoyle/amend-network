import { z } from "zod";

const hexKey = z
  .string()
  .length(64)
  .regex(/^[0-9a-fA-F]+$/, "expected 32-byte hex key");

const emptyToUndefined = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value : undefined));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_MIGRATE: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  PII_ENCRYPTION_KEY: hexKey,
  EMAIL_LOOKUP_KEY: hexKey,
  SEED_PASSWORD: z.string().min(12),
  SEED_MFA_SECRET: emptyToUndefined,
  EMAIL_TRANSPORT: z.enum(["json", "smtp"]).default("json"),
  EMAIL_JSON_DIR: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  AUTH_URL: z.string().optional(),
  ADMIN_ALERT_EMAIL: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  CLAMD_HOST: emptyToUndefined,
  CLAMD_PORT: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  POSTHOG_KEY: emptyToUndefined,
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

function applyNonProductionStorageFallbacks(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  process.env.S3_ENDPOINT ||= "http://127.0.0.1:9000";
  process.env.S3_REGION ||= "us-east-1";
  process.env.S3_BUCKET ||= "amend-resources";
  process.env.S3_ACCESS_KEY_ID ||= "minioadmin";
  process.env.S3_SECRET_ACCESS_KEY ||= "minioadmin";
}

function applyRuntimeUrlFallbacks(): void {
  if (!process.env.AUTH_URL?.trim() && process.env.RENDER_EXTERNAL_URL?.trim()) {
    process.env.AUTH_URL = process.env.RENDER_EXTERNAL_URL.trim();
  }
}

export function env(): AppEnv {
  if (!cached) {
    applyNonProductionStorageFallbacks();
    applyRuntimeUrlFallbacks();
    cached = envSchema.parse(process.env);
  }
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
