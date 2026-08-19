# Quickstart: Data Retention Jobs (local)

Proves this slice against **local** Postgres 16. No DreamHost. No browser. No production cron.

## Prerequisites

Same as [../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm, Docker Postgres, `.env` from `.env.example`.

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
```

No new seed users required. Tests insert aged `audit_log` rows, expired tokens, expired invitations, and a deactivated member with leftover directory copies.

## Automated validation

```bash
pnpm test
pnpm test:rls
pnpm typecheck
pnpm lint
```

Expect:

- Integration: frozen `now` — 7y security gone, 6y security kept; 3y+1d info gone (including old `retention_purged`); 2y info kept; new `retention_purged` from this run kept; second run adds no trail rows; anonymized user decrypts to sentinel/empty and directory copies gone; `resources.uploaded_by` unchanged; expired/revoked invites gone, pending kept.
- RLS file `tests/rls/retention-policies.test.ts`: Pathways cannot DELETE `audit_log`; Admin without `retention` cannot; Admin+`retention` cannot reactivate a deactivated user or DELETE a pending invite; **`authMode: "retention"` appears exactly once under `lib/` + `app/` + `scripts/`, in `runRetentionJob`.**
- Unit: anonymize uses `encryptPii` / `hmacEmailLookup`; audit metadata keys miss the PII denylist.

`pnpm test:a11y` is **not** required (no pages).

## Manual local run (optional)

```bash
pnpm retention:run
```

Prints JSON counts. Against a fresh seed this should be mostly zeros (seed data is new). Does not start nginx or systemd.
