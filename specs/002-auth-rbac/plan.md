# Implementation Plan: Authentication & Role-Based Access Control

**Branch**: `002-auth-rbac` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-auth-rbac/spec.md`

## Summary

Deliver sign-in, revocable server-side sessions, three-layer authorization (`middleware` → `requireRole` → native Postgres RLS), administrative TOTP, and an append-only audit writer. First application scaffold (Next.js 15 App Router + Prisma + Auth.js v5) running locally against Postgres 16. No DreamHost, no registration/invitation. Representative `visibility_records` prove layer 3 before content features exist.

Technical approach: Auth.js Credentials with an **opaque session id** in a signed cookie and a Postgres `sessions` row as source of truth; Prisma runtime role `amend_app` with transaction-local GUCs and FORCE RLS; AES-256-GCM PII plus HMAC email lookup; Argon2id; `otpauth` TOTP; audit INSERT-only.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, standalone output), Auth.js v5, Prisma 6, Tailwind CSS + shadcn/ui (CSS custom properties), `@node-rs/argon2`, `otpauth`, Nodemailer, Zod

**Storage**: PostgreSQL 16 (local Docker). Runtime role `amend_app` (RLS enforced). Migrate role `amend_owner` (BYPASSRLS).

**Testing**: Vitest (unit + integration + app permission matrix). `pnpm test:rls` against Postgres as `amend_app` with application bypassed. axe-core (`pnpm test:a11y`) on sign-in, holding, sessions, MFA, and admin placeholder pages.

**Target Platform**: Local developer machine (Windows/macOS/Linux) + later the self-managed VPS. This slice has **no** DreamHost dependency.

**Project Type**: Single Next.js full-stack web application at repository root (AGENTS.md layout).

**Performance Goals**: Authenticated shell JS ≤ 180 KB gzip (server components default; `use client` only at form leaves). Sign-in to member home < 30s locally (SC-001).

**Constraints**: Three authorization layers on every data path; `requireRole` never mocked in role tests; no client-supplied roles; session cookie expires on browser close; no remember-me; Argon2id; AES-256-GCM PII; audit append-only in the same transaction; secrets only from env; CSRF on mutations; WCAG 2.1 AA on new pages.

**Scale/Scope**: Seeded accounts (8 statuses/roles), ~10 routes, 1 visibility-gated fixture table, permission matrix (7 roles × 21 capabilities; unbuilt rows fail closed). Launch cohort size does not change this slice.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | Middleware on `/app/*` and `/admin/*`; `requireRole` from signed session; native RLS + query filters; visibility intersection; admin vs program role; `mfa_satisfied` on `/admin` | Pass |
| II. Privacy and audit | PII encrypted at rest; audit append-only, same transaction; no PII in logs; analytics not in this slice | Pass |
| III. Self-operated infra | Env-only connection strings; local Postgres; no assumed managed KMS/WAF | Pass |
| IV. Test-first permission proof | Matrix twice (app + RLS); unauthorized tests; `requireRole` not mocked | Pass |
| V. Accessible, token-driven UI | New pages use tokens; `pnpm test:a11y`; 44px targets; no hard-coded colours | Pass |
| Stack | Auth.js v5, Prisma, Postgres RLS, Argon2id, Next standalone | Pass |
| YAGNI | No extra identity vendor, no Redis, no Prisma Postgres rules | Pass |

No unjustified violations. Complexity Tracking remains empty.

### Post-design (pass)

Phase 1 artifacts keep native RLS (not Prisma Postgres `@@rls`), session revoke via DB row, INSERT-only `audit_log` grants, HMAC email lookup, and fail-closed matrix rows. `lib/crypto/pii.ts` is a **new** module because no crypto helper exists yet (constitution: say why). Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-rbac/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md              # created by /speckit-tasks, not this command
```

### Source Code (repository root)

```text
app/
├── (auth)/                          # /login, /forgot-password, /reset-password, MFA
├── (member)/app/                    # dashboard, pending, profile/sessions
├── (admin)/admin/                   # placeholder home + audit-log read
├── api/auth/[...nextauth]/route.ts
└── layout.tsx
middleware.ts                        # layer 1: session required for /app, /admin
components/                          # presentational only; no role logic
lib/
├── auth/                            # session, requireRole, MFA, throttle, cookies
├── audit/                           # append-only writer
├── crypto/                          # NEW: AES-256-GCM + HMAC lookup (no existing helper)
├── db/                              # Prisma client, RLS GUC extension, migrator client
└── email/                           # Nodemailer transports
prisma/
├── schema.prisma
├── migrations/                      # includes RLS policies, grants, GIN index
└── seed.ts
tests/
├── unit/
├── integration/
├── app/permission-matrix.test.ts
├── rls/permission-matrix.test.ts
└── a11y/
docker-compose.yml                   # postgres:16 + optional mailpit
.env.example
```

**Structure Decision**: Single Next.js app at repo root per AGENTS.md. Route groups `(auth)` / `(member)` / `(admin)`. `components/` has no data fetching and no role branches — visibility is data, not `if (role === ...)`. `lib/crypto/` is new (PII encryption is not an extension of `lib/auth/` session helpers).

## Complexity Tracking

> No constitution violations to justify.
