# Quickstart: Authentication & RBAC (local)

Proves the slice against a **local** Postgres 16. No DreamHost.

## Prerequisites

- Node 24, pnpm
- Docker (Postgres 16; optional Mailpit)
- Copy `.env.example` → `.env` and fill secrets locally (never commit)

Required env (names only): `DATABASE_URL`, `DATABASE_URL_MIGRATE`, `AUTH_SECRET`, `PII_ENCRYPTION_KEY`, `EMAIL_LOOKUP_KEY`, `SEED_PASSWORD`, `EMAIL_TRANSPORT` (`json` or `smtp`).

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
```

## Automated validation

```bash
pnpm test          # includes app permission matrix; requireRole not mocked
pnpm test:rls      # same matrix against Postgres as amend_app
pnpm test:a11y     # axe on login, pending, sessions, MFA, admin pages
pnpm typecheck
pnpm lint
```

Expect: 100% deny on unauthorized matrix cells; fail-closed rows for unbuilt capabilities; 0 LEAD-only rows for Pathways (and reverse); audit INSERT-only (update/delete fail).

## Manual validation (optional)

```bash
pnpm dev
```

Use seed accounts from [data-model.md](./data-model.md) (password = `SEED_PASSWORD`).

| Check | Expect |
| --- | --- |
| Sign in `pathways@local` | `/app`; log out visible; no remember-me |
| Sign in `lead@local` | Cannot see pathways-only fixture |
| Sign in `pending@local` | `/app/pending` only |
| Sign in `denied@local` or bad password | Same generic message |
| Sign in `admin@local` (MFA off) | `/admin` blocked until enroll + code |
| Two browsers, revoke one session | Revoked session dead; other lives |
| Forgot password (json transport) | Success UX; complete reset; all sessions dead |
| Close browser | Cookie gone; must sign in again |
| 11th failed login in 15 minutes | Still generic message; security audit row |

Reset tokens: with `EMAIL_TRANSPORT=json`, read the captured message file (path in `.env.example`). Do not print tokens in the app log.

## Contracts

- [auth-http.md](./contracts/auth-http.md)
- [session.md](./contracts/session.md)
- [audit-events.md](./contracts/audit-events.md)
- [permission-matrix.md](./contracts/permission-matrix.md)
- [rls-policies.md](./contracts/rls-policies.md)
