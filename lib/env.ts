import { z } from "zod";

const hexKey = z
  .string()
  .length(64)
  .regex(/^[0-9a-fA-F]+$/, "expected 32-byte hex key");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_MIGRATE: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  PII_ENCRYPTION_KEY: hexKey,
  EMAIL_LOOKUP_KEY: hexKey,
  SEED_PASSWORD: z.string().min(12),
  SEED_MFA_SECRET: z.string().optional(),
  EMAIL_TRANSPORT: z.enum(["json", "smtp"]).default("json"),
  EMAIL_JSON_DIR: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  AUTH_URL: z.string().optional(),
  ADMIN_ALERT_EMAIL: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function env(): AppEnv {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
