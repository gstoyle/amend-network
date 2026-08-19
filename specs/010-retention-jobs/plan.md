# Implementation Plan: Data Retention Jobs

**Branch**: `010-retention-jobs` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-retention-jobs/spec.md`

## Summary

Deliver PRD §6 as a **weekly retention pass**: drop security audit rows older than 7 years, other audit rows older than 3 years (including old `retention_purged` rows), age product analytics 24 months, anonymize deactivated members after 3 years of inactivity, and delete leftover expired/consumed password-reset tokens and expired/revoked invitations. Each class that actually removes or anonymizes rows writes one **info** `retention_purged` trail row with `{ class, count }` in the same transaction.

Technical approach: reuse `runInvitationSweep(now)`’s shape (`lib/retention/run.ts`, injectable `now`, `withRls`, no HTTP, no DreamHost cron). New GUC `app.auth_mode = 'retention'` plus DELETE/UPDATE policies so `amend_app` can do this work without `SECURITY DEFINER` PII writes — ciphertext still from `encryptPii` / `hmacEmailLookup`. Content attribution FKs stay. Analytics uses a port (no new Postgres event table).

**PRD §11 Q7**: default windows. Production timer remains `infra/`.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, unused for this job), Auth.js v5 (unused), Prisma 6, Zod. **No new libraries.** Argon2id via existing `hashPassword`.

**Storage**: PostgreSQL 16 (local Docker, `amend_app` FORCE RLS). No new tables. One migration: `retention_purged` on `audit_log.action` CHECK, GRANTs, retention policies. No object storage.

**Testing**: Vitest unit + integration. `pnpm test:rls` file `tests/rls/retention-policies.test.ts` (required standalone). No `test:a11y`.

**Target Platform**: Local developer machine. **No** DreamHost dependency.

**Project Type**: Single Next.js full-stack app at repository root; this slice is a local/cron-invocable function + optional `pnpm retention:run`.

**Performance Goals**: Seed-scale weekly pass in tests under 10s with frozen `now`. No page JS budget.

**Constraints**: Three authorization layers (no route; job still uses `withRls`; RLS DELETE only with `retention` mode); `requireRole` unused and must not be mocked in RLS tests; no client roles; `writeAudit` same transaction; no PII in metadata; encryption helpers only; Constitution III — no production cron; env-only DB URLs.

**Scale/Scope**: Six deletion/anonymize classes, one action name, one auth mode, no UI.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | No `/app` or `/admin` route. Mutations only inside `withRls` + `auth_mode=retention`. Native RLS DELETE/UPDATE policies; Pathways/Admin-without-mode get 0 rows | Pass |
| II. Privacy and audit | `encryptPii`/`hmacEmailLookup`/`hashPassword`; no raw SQL plaintext; `retention_purged` is info, ages out at 3y; metadata `{class,count}` only; append-only inside windows; same transaction | Pass |
| III. Self-operated infra | No new host services; no crontab in this slice; env-only DB | Pass |
| IV. Test-first permission proof | Fail-first integration + **standalone** RLS file; `requireRole` not used; second-run idempotency | Pass |
| V. Accessible, token-driven UI | N/A — no pages. Do not add `use client` | Pass |
| Stack | Prisma, native RLS, existing audit writer, existing invitation-sweep invocation pattern | Pass |
| YAGNI | No HTTP, no retention settings UI, no DEFINER PII, no content FK rewrites, no warehouse | Pass |
| §11 | Q7 defaults named; Q13 not opened | Pass |

No unjustified violations. Complexity Tracking remains empty.

`lib/retention/run.ts` is **new** because `lib/registration/sweep.ts` is invitation expiry + mail (research §1). `lib/analytics/retention.ts` is **new** beside `track.ts` so purge cannot emit events.

### Post-design (pass)

Phase 1: time windows in **application** `WHERE` with injected `now`; RLS only gates role + `retention` mode (+ invitation status). Anonymization ciphertext built in Node. Audit DELETE is not open to ordinary admin requests. Analytics port default 0 without a local event table. Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/010-retention-jobs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rls-policies.md
│   ├── job.md
│   └── audit-events.md
└── tasks.md             # /speckit-tasks — not this command
```

### Source Code (repository root)

```text
lib/
├── registration/sweep.ts          # NOT modified (invitation expiry + mail)
├── retention/run.ts               # NEW: runRetentionJob(now)
├── analytics/track.ts             # NOT emitting new events
├── analytics/retention.ts         # NEW: AnalyticsRetentionPort
├── audit/actions.ts               # EXTEND: retention_purged
├── audit/write.ts                 # reused
├── crypto/pii.ts                  # reused encryptPii / hmacEmailLookup
├── auth/password.ts               # reused hashPassword
└── db/rls.ts                      # EXTEND: authMode "retention"
scripts/
└── run-retention.ts               # NEW: pnpm retention:run
prisma/migrations/                 # CHECK + GRANT DELETE + policies
app/                               # NO new routes
tests/
├── unit/retention-anonymize.test.ts
├── integration/retention-job.test.ts
└── rls/retention-policies.test.ts # REQUIRED standalone
```

**Structure Decision**: Same single Next.js repo. No `(admin)` pages. `components/` unused.

## Required standalone tasks (`/speckit-tasks`)

`/speckit-tasks` MUST emit the following as **its own task ID**, fail-first, with this file path. Do **not** fold it into a generic “write retention tests” item. Helper-path tests do not satisfy this.

- Write failing tests in `tests/rls/retention-policies.test.ts` that set GUCs and run **raw SQL** (not `runRetentionJob`): (1) Pathways `DELETE FROM audit_log` affects 0 rows; (2) Admin **without** `app.auth_mode=retention` `DELETE FROM audit_log` affects 0; (3) Admin **with** `retention` cannot `UPDATE users SET status = 'active'` on a deactivated row; (4) Admin with `retention` cannot `DELETE` a pending invitation; (5) Admin with `retention` can `UPDATE` ciphertext on a deactivated user **keeping** `status = deactivated`; **(6) walk `lib/`, `app/`, and `scripts/` and assert `/authMode:\s*["']retention["']/` matches exactly once, in the module that exports `runRetentionJob`.** Cite [contracts/rls-policies.md](./contracts/rls-policies.md) item 5. Do not treat this as an untested comment on T028-style tasks.

## Complexity Tracking

> No constitution violations to justify.
