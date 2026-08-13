# Research: Authentication & Role-Based Access Control

**Feature**: `002-auth-rbac` | **Date**: 2026-08-12

All Technical Context unknowns are resolved below. Stack choices are constitution-mandated unless noted.

## 1. Session strategy (Auth.js Credentials + revocable sessions)

**Decision**: Use Auth.js v5 Credentials for password verification. Persist sessions in our `sessions` table. The browser cookie is a signed Auth.js JWT whose payload is **only the opaque session id** (plus Auth.js internals). Every request loads the session row and user roles from Postgres. Logout and revoke **delete or stamp** that row; a leftover cookie cannot be reused. Cookie flags: httpOnly, Secure, SameSite=Lax, **no Max-Age/Expires** (browser-close). Sliding 24h and absolute 30d are enforced on the row (`last_seen_at`, `created_at`, `expires_at`).

**Rationale**: Auth.js JWT-only sessions cannot be revoked before expiry without a blocklist ([session strategies](https://authjs.dev/concepts/session-strategies)). Constitution and PRD §5.1 require a server-side record. Credentials + the stock database adapter is unsupported/fragile (Credentials has no Account row). An opaque id in a signed cookie plus our table satisfies both Auth.js-as-the-auth-library and revoke-on-logout.

**Alternatives considered**:

- JWT claims as source of roles — rejected; roles must come from the signed session record / DB, never from a client-echoed claim.
- Auth.js `strategy: "database"` with Prisma adapter — rejected for Credentials; would also force Auth.js User/Account shape onto our User entity.
- Clerk or similar SaaS — rejected; constitution stack is Auth.js, no extra identity vendor.

## 2. Native RLS with Prisma (not Prisma Postgres rules)

**Decision**: Two Postgres roles: `amend_owner` (migrations, `BYPASSRLS`) and `amend_app` (runtime, **no** bypass). Prisma runtime client uses `DATABASE_URL` as `amend_app`. A Prisma client extension opens a transaction, `set_config` of `app.user_id`, `app.program_role`, `app.admin_role`, `app.status` (third argument `true` = transaction-local), then runs the query. Visibility-gated tables: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`. Policies use `visibility && role_tokens(...)` where `role_tokens` is a SQL function from those settings. `pnpm test:rls` connects as `amend_app` and sets the same GUCs **without** calling `requireRole`.

**Rationale**: Constitution Principle I: RLS is native Postgres and must hold when layer 2 is missed. Prisma’s `@@rls` / `AuthorizedClient` path is Prisma Postgres (managed) and is forbidden.

**Alternatives considered**:

- Single superuser Prisma connection + application WHERE only — rejected; misses layer 3.
- Prisma Postgres security rules — rejected; vendor-specific.
- Security-barrier views instead of RLS — extra objects; RLS is the mandated layer.

## 3. Password hashing

**Decision**: `@node-rs/argon2` with Argon2id. Parameters documented in code comments and match current OWASP/NIST-aligned defaults for the runtime. No bcrypt path unless Argon2 fails to load (then bcrypt cost ≥ 12, recorded as a defect to fix).

**Rationale**: PRD §5.1 and constitution. `@node-rs/argon2` ships prebuilds for Windows (local) and Linux (VPS). Node 24 has no built-in Argon2.

**Alternatives considered**: `argon2` (node-gyp, painful on Windows); bcrypt-only — fails the Argon2id requirement.

## 4. PII encryption and email login

**Decision**: Application-layer AES-256-GCM (`node:crypto`). Envelope: version byte + 12-byte IV + ciphertext + 16-byte tag, stored as `bytea`. Keys from env: `PII_ENCRYPTION_KEY` (32-byte), `EMAIL_LOOKUP_KEY` (HMAC key). Login lookup uses `email_lookup = HMAC-SHA256(EMAIL_LOOKUP_KEY, lowercase(trim(email)))` unique index. Encrypted columns: email, first_name, last_name, mfa_secret. `password_hash` is a hash, not encrypted. New module `lib/crypto/pii.ts` — no existing helper to extend.

**Rationale**: Constitution Principle II / PRD §8; no vendor KMS. Email must remain a login identifier (spec assumption).

**Alternatives considered**: Deterministic AES for email — weaker than HMAC lookup + random-IV GCM. Database `pgcrypto` with key in SQL — key would sit in the connection string or SQL logs.

## 5. TOTP MFA

**Decision**: `otpauth` for TOTP generate/verify (30s, 6 digits, SHA1 — authenticator-app default). Enrollment stores encrypted secret, `mfa_enabled=true` only after a successful challenge. `sessions.mfa_satisfied` is per session; new session requires a new challenge; enrollment is once until Super Admin reset. QR as `otpauth://` URI (no third-party QR SaaS).

**Rationale**: Constitution: TOTP for administrative roles; `mfa_satisfied` on every `/admin` route.

**Alternatives considered**: WebAuthn-only — not in PRD. `speakeasy` — unmaintained. Backup codes — spec out of scope.

## 6. Lockout without account enumeration

**Decision**: Table `auth_throttle`: key = HMAC of normalized email (same lookup key family), `failed_count`, `window_started_at`, `locked_until`. Unknown and known emails share the table so lockout cannot prove existence. User-visible copy is one generic string for wrong password, unknown email, denied, deactivated, and lockout.

**Rationale**: FR-013, FR-015.

**Alternatives considered**: Counter on `users` — cannot throttle unknown emails without creating users. Redis — not in stack.

## 7. Local email (password reset)

**Decision**: Nodemailer. `EMAIL_TRANSPORT=json` (tests, CI) writes parsed messages to a directory or test spy. `EMAIL_TRANSPORT=smtp` for local Mailpit (`docker-compose` service, not required for `pnpm test`). Production Postmark is **not** wired in this slice.

**Rationale**: Spec Q6: captured/local mailbox; no DreamHost/Postmark dependency.

**Alternatives considered**: Real Postmark in local — needs secrets and network. Console.log of reset URLs — leaks tokens into logs (forbidden).

## 8. CSRF

**Decision**: Auth.js CSRF cookie/token on Auth.js routes. State-changing app routes use Next.js Server Actions (origin check) or double-submit of the Auth.js CSRF token. No custom POST without CSRF.

**Rationale**: PRD §8, constitution.

## 9. App scaffold and Next.js version

**Decision**: First application code at repo root (no app exists today). Next.js **15** App Router, TypeScript strict, `output: 'standalone'`, pnpm, Tailwind + shadcn/ui tokens. Keep `middleware.ts` (Auth.js `auth()` wrapper). Do not take Next.js 16 “proxy” rename in this slice. Node 24.

**Rationale**: Constitution stack; Auth.js Next.js docs wrap `middleware.ts`.

**Alternatives considered**: Next 16 proxy — extra churn vs Auth.js examples. Split frontend/backend — rejected by PRD Option A.

## 10. Permission matrix tests

**Decision**: Shared fixture of seed users + `visibility_records`. `tests/app/permission-matrix.test.ts` hits route handlers / server helpers (real `requireRole`, never mocked). `tests/rls/permission-matrix.test.ts` (`pnpm test:rls`) uses `amend_app` + GUCs only. Unbuilt capabilities (resources, forum, …) assert **deny**. Implemented capabilities assert PRD §3 allow/deny.

**Rationale**: Constitution Principle IV.

## 11. Audit writer

**Decision**: `lib/audit/write.ts` accepts the Prisma transaction client. `audit_log`: `GRANT INSERT, SELECT`; `REVOKE UPDATE, DELETE, TRUNCATE` from `amend_app`. No FKs. `actor_role` is a snapshot string. Auth events in this slice listed in contracts. Full PRD §6 action enum stored as text check constraint so later slices do not migrate the table.

**Rationale**: Constitution Principle II; spec FR-017–FR-019.

## 12. Local Postgres

**Decision**: `docker-compose.yml` with Postgres 16. Init script creates `amend_owner` and `amend_app`. `.env.example` documents `DATABASE_URL`, `DATABASE_URL_MIGRATE`, `AUTH_SECRET`, `PII_ENCRYPTION_KEY`, `EMAIL_LOOKUP_KEY`, `SEED_PASSWORD`. No hostnames hard-coded.

**Rationale**: Spec target: local, no DreamHost.
