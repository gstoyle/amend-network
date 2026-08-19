# Research: Data Retention Jobs

**Feature**: `010-retention-jobs` | **Date**: 2026-08-18

All Technical Context unknowns are resolved below. Stack and `withRls` come from `002`. Invocation shape comes from `003` `runInvitationSweep(now)`. Clarifications (2026-08-18): deletion-trail rows are non-security and age out at 3 years; anonymization is personal-detail copies only, via `encryptPii` / `hmacEmailLookup`.

## 1. One exported job, injectable clock, no HTTP, no production cron

**Decision**: `export async function runRetentionJob(now: Date = new Date()): Promise<RetentionJobResult>` in **new** `lib/retention/run.ts`. Optional local bin `scripts/run-retention.ts` + `pnpm retention:run` for operators. **No** App Router route. **No** systemd unit or crontab in this slice (`infra/`).

`lib/registration/sweep.ts` stays invitation expiry + reminder mail only. Retention is a different cadence, different mutations (DELETE / anonymize vs status UPDATE), and must not send mail.

**Rationale**: Spec FR-002; Constitution III; AGENTS.md — new file because extending the invitation sweep would mix mail + 14-day expiry with weekly destruction.

**Alternatives considered**:

- Fold into `runInvitationSweep` — rejected; different schedule and no mail.
- HTTP cron route — rejected; spec forbids a staff/member web address.
- DreamHost cron in this PR — rejected; Constitution III.

## 2. `app.auth_mode = 'retention'` plus GRANTs — do not SECURITY DEFINER the PII writes

**Decision**: Extend `RlsContext.authMode` with `"retention"`. The job calls `withRls({ adminRole: "admin", status: "active", authMode: "retention" }, ...)`. That `authMode: "retention"` literal is the **only** production call site under `lib/`, `app/`, and `scripts/`. `pnpm retention:run` only invokes `runRetentionJob`. RLS proofs set `app.auth_mode` with raw SQL, not a second `withRls({ authMode: "retention" })`. The standalone RLS file **asserts** this with a source scan (same confinement as `resource_download` / `invite_lookup` to their owner modules).

Today `amend_app` **cannot**:

- `UPDATE` deactivated users (`users_update_admin` only moves **pending** → active/denied)
- `DELETE` `audit_log` (INSERT/SELECT only)
- `DELETE` invitations (no DELETE grant)
- `DELETE` password-reset tokens except `auth_mode = password_reset`
- `DELETE` other users’ sessions or directory copies (owner / self GUCs)

PII replacements **must** be computed in Node (`encryptPii`, `hmacEmailLookup`, `hashPassword` of random bytes). Postgres has no application DEK (Constitution II). Therefore anonymization is Prisma/SQL **parameters** of ciphertext, not a `SECURITY DEFINER` that writes plaintext.

Migration (one file):

- `GRANT DELETE` on `audit_log`, `invitations`, `password_reset_tokens`, `sessions` (directory tables already have DELETE)
- `users_update_retention`: `USING` admin + `auth_mode = retention` + `status = deactivated`; `WITH CHECK` same and still `deactivated` (no reactivation)
- `FOR DELETE` policies on audit_log, invitations, password_reset_tokens, sessions, directory listings/shown-* requiring `admin_role IN ('admin','super_admin')` **and** `auth_mode = 'retention'`
- Invitation DELETE `USING` also `status IN ('expired','revoked')` so pending/accepted cannot be removed even if the job is buggy
- **Time windows stay in the application `WHERE`** (injected `now`), not `now()` inside RLS — same reason invitation sweep tests freeze the clock

No new `authMode` for 009 snapshot. This value is only for destructive retention.

**Rationale**: Layer 3 still holds if layer 2 is skipped: Pathways GUC cannot DELETE audit rows. Admin **without** `retention` still cannot. Layer 2 is “no HTTP.”

**Alternatives considered**:

- Broad admin DELETE on `audit_log` — rejected; an ordinary admin request could wipe evidence.
- One DEFINER purge of all classes — rejected; would encrypt PII in SQL or bypass helpers.
- Job as `amend_owner` — rejected; bypasses RLS.

## 3. Class windows and `retention_purged`

**Decision**: Cutoffs from injected `now` (UTC):

| Class | Predicate | Count meaning |
| --- | --- | --- |
| Audit security | `severity = security` AND `created_at < now - 7 years` | rows deleted |
| Audit other | `severity IN (info, warning)` AND `created_at < now - 3 years` | rows deleted |
| Analytics | port `deleteOlderThan(now - 24 months)` | events deleted |
| Users anonymized | `status = deactivated` AND inactivity ≥ 3 years AND not already sentinel lookup | accounts processed |
| Password-reset tokens | `expires_at < now` OR `consumed_at IS NOT NULL` | rows deleted |
| Invitations | `status IN (expired, revoked)` | rows deleted |

Per class with `count > 0`: `writeAudit` in the **same** transaction, `action: retention_purged`, `severity: info`, `actorRole: system`, `metadata: { class, count }` only. Add `retention_purged` to `AUDIT_ACTIONS` and the `audit_log.action` CHECK.

Order inside the transaction: **mutations first**, then audit inserts for classes that deleted/anonymized > 0. New `retention_purged` rows have `created_at = clock_timestamp()` so they fail the “older than 3 years” predicate in this run (clarification: same-run keep). A later run three years on may delete those trail rows as ordinary info.

Do not delete `retention_purged` in a special immortal way. Second run: 0 extra work, 0 extra trail rows.

**Rationale**: Spec FR-003–011; clarification session; Constitution II append-only *inside* the window.

**Alternatives considered**: Security severity on `retention_purged` — rejected (7-year pile of counts). One row for the whole job — rejected (PRD wants per-class counts).

## 4. Anonymization sentinel and copies

**Decision**: For each eligible user, in one transaction with the rest of the job:

1. `passwordHash` ← `hashPassword(randomBytes(32).toString("hex"))` (unusable verifier; Argon2id like the rest of auth)
2. Encrypted scalars ← `encryptPii("")` for names, title, DOC id, denial reason; `mfaSecretEncrypted` null; `mfaEnabled` false; `registrationIp` null; `directoryVisible` and shown-field flags false
3. `emailLookup` ← `hmacEmailLookup(\`anonymized.${userId}@retention.invalid\`)` (unique, not the person’s email)
4. `emailEncrypted` ← `encryptPii(\`anonymized.${userId}@retention.invalid\`)`
5. `DELETE` leftover `directory_listings` / `directory_shown_*` / `directory_search_throttle` for that `user_id`
6. `DELETE` `sessions` and `password_reset_tokens` for that `user_id`
7. Do **not** touch `resources.uploaded_by`, `events.host_user_id` / `created_by`, `announcements.created_by`, `audit_log.actor_user_id`

Eligibility: `status = deactivated` AND `emailLookup` is **not** already the sentinel HMAC AND inactivity start ≤ `now - 3 years`.

Inactivity start: `max(deactivatedAt, lastLoginAt)` where `deactivatedAt` is `created_at` of the latest `account_deactivated` row for `target_user_id` (else `users.updated_at` if no trail row — named fallback for fixtures). A later `login_success` after that timestamp would raise `lastLoginAt` and reset the clock (spec); deactivated users cannot sign in today, so this is defensive.

Idempotency: sentinel lookup ⇒ skip (count 0).

**Rationale**: Clarification A; unique `email_lookup`; Constitution II helpers.

**Alternatives considered**: SQL `SET email = NULL` — rejected (NOT NULL + bypasses crypto). Nulling `uploaded_by` — rejected (clarification). Hard-delete user row — rejected (FK + spec).

## 5. Product analytics port (no Postgres event table)

**Decision**: `lib/analytics/track.ts` stays outbound-only and still does not persist events in Postgres. New `AnalyticsRetentionPort` in `lib/analytics/retention.ts` (same folder, not `track.ts`, so a purge cannot accidentally `track()`).

- Tests inject an in-memory store with timestamps (SC-006).
- Default production adapter: if no delete client is configured, return `0` (no fake count). PostHog project retention (24 months) remains **infra / vendor setting** until a real delete API is wired; this slice still **calls** the port every run so the audit class is real when the adapter returns > 0.

Do not query PostHog from `audit_log`.

**Rationale**: Spec FR-006; 009 forbade a second evidence store; `track()` currently no-ops without a local table.

**Alternatives considered**: Mirror events in Postgres — rejected (conflates insight and evidence). Skip the class entirely — rejected (spec P3).

## 6. Constitution IV proofs

**Decision**: Fail-first tests:

- `tests/integration/retention-job.test.ts` — frozen `now`, all six classes, second run, same-run trail kept, PII denylist on metadata
- `tests/rls/retention-policies.test.ts` — **required standalone**: raw SQL DELETE/UPDATE **without** `runRetentionJob` / `requireRole`: Pathways 0; Admin without `retention` 0; Admin+retention deletes only aged security/info rows and only expired/revoked invites; cannot UPDATE deactivated → active via retention policy; cannot DELETE pending invite. **Also** walk `lib/`, `app/`, and `scripts/` and assert the literal `authMode: "retention"` appears in **exactly one** file, the module that exports `runRetentionJob` (one occurrence).
- `tests/unit/retention-anonymize.test.ts` — decrypt after job ≠ original; `hmacEmailLookup(originalEmail)` no longer matches; content `uploaded_by` unchanged

No `test:a11y` pages. No `requireRole` mock.

**Rationale**: Constitution IV; 009 snapshot test file pattern.

## 7. PRD §11

**Decision**: Q7 — proceed on PRD default windows (already in spec assumptions). Q13 residency — not opened. Analytics vendor delete API — named assumption in §5, not a silent extra Q.
