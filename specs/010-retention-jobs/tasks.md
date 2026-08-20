# Tasks: Data Retention Jobs

**Input**: Design documents from `/specs/010-retention-jobs/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV, spec FR-013 / FR-015, and [plan.md](./plan.md) require fail-first proofs. Write the listed tests first and confirm they **fail** before implementation. Do not mock `requireRole` in RLS tests. Do not call `runRetentionJob` from the standalone RLS file except as the **scan target** (the file that must contain the single `authMode: "retention"` literal).

**Organization**: Setup → Foundational (blocks all stories) → US1–US4 in spec order → polish.

**No HTTP. No production cron.** Do not add `app/**/route.ts` for this job. Do not modify `lib/registration/sweep.ts` (invitation expiry + mail stays there).

**Standalone RLS**: T002 is its own task and file. Do **not** fold it into a generic retention test suite. Helper-path tests do not satisfy T002. Item (6) — production single call site — is an **asserted scan**, not a comment.

**PRD §11 Q7**: Default windows. Named in spec assumptions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US4) on story-phase tasks only
- Every task has a concrete file path

## Path Conventions

Repository-root Next.js app per plan.md (`lib/`, `prisma/`, `scripts/`, `tests/`). Existing helpers: `withRls` in `lib/db/rls.ts`, `writeAudit` in `lib/audit/write.ts`, `encryptPii` / `hmacEmailLookup` / `decryptPii` in `lib/crypto/pii.ts`, `hashPassword` in `lib/auth/password.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new packages. Confirm ignore files already cover Node/Docker/env from prior slices.

- [x] T001 Verify `.gitignore`, `.dockerignore`, and `eslint.config.mjs` `ignores` already include `node_modules/`, `dist/`, `.env*`, `*.log` (append only if a required pattern is missing)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `authMode: "retention"` GUC, DELETE/UPDATE policies, `retention_purged` action, stub `runRetentionJob`. **No user story work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US4

### Tests (fail first)

- [x] T002 [P] Write failing tests in `tests/rls/retention-policies.test.ts` that set GUCs and run **raw SQL** (not `runRetentionJob`, not `requireRole`): (1) Pathways `DELETE FROM audit_log` affects 0 rows and `DELETE FROM invitations` affects 0; (2) Admin **without** `app.auth_mode=retention` `DELETE FROM audit_log` affects 0 and `UPDATE` ciphertext on a deactivated user affects 0; (3) Admin **with** `retention` cannot `UPDATE users SET status = 'active'` on a deactivated row; (4) Admin with `retention` cannot `DELETE` a **pending** invitation; (5) Admin with `retention` can `UPDATE` ciphertext on a deactivated user **keeping** `status = deactivated`. **(6) Recursively read `lib/`, `app/`, and `scripts/` (`.ts`/`.tsx`); count `/authMode:\s*["']retention["']/`; expect exactly 1 match, in the file that exports `runRetentionJob` (not `lib/db/rls.ts` union, not `scripts/run-retention.ts`).** Policy cases in this file MUST set `app.auth_mode` via raw `set_config`, not `withRls({ authMode: "retention" })`. Cite [contracts/rls-policies.md](./contracts/rls-policies.md) items 1–5. This task MUST stay standalone.

### Implementation

- [x] T003 Add migration under `prisma/migrations/` that: extends `audit_log.action` CHECK with `retention_purged`; `GRANT DELETE` on `audit_log`, `invitations`, `password_reset_tokens`, `sessions` to `amend_app`; adds `users_update_retention` (admin + `auth_mode=retention` + `status=deactivated`, WITH CHECK still deactivated); adds DELETE policies for audit_log, invitations (`status IN ('expired','revoked')`), password_reset_tokens, sessions, and directory listing/shown-* requiring admin + `retention`. Do **not** put age windows in RLS. Do **not** SECURITY DEFINER PII writes. Cite [contracts/rls-policies.md](./contracts/rls-policies.md).
- [x] T004 [P] Extend `authMode` union with `"retention"` and `set_config('app.auth_mode', …)` in `lib/db/rls.ts` (same pattern as `password_reset` / `invite_lookup` / `resource_download`)
- [x] T005 [P] Add `retention_purged` to `AUDIT_ACTIONS` in `lib/audit/actions.ts` (info-only; metadata `{ class, count }` per [contracts/audit-events.md](./contracts/audit-events.md))
- [x] T006 Add stub `runRetentionJob(now?: Date)` in `lib/retention/run.ts` that calls **exactly one** `withRls({ adminRole: "admin", status: "active", authMode: "retention" }, …)` and returns zero counts (`RetentionJobResult` per [data-model.md](./data-model.md)). This is the sole production `authMode: "retention"` literal. Do not add HTTP. Do not edit `lib/registration/sweep.ts`.

**Checkpoint**: `pnpm db:migrate` succeeds. T002 items 1–6 pass against the stub (scan finds one site; policy SQL matches [contracts/rls-policies.md](./contracts/rls-policies.md)). Existing `002`–`009` tests still pass. User stories may start.

---

## Phase 3: User Story 1 - Age out audit evidence after the policy window (Priority: P1) 🎯 MVP

**Goal**: With frozen `now`, delete security `audit_log` rows older than 7 years and other severities older than 3 years (including old `retention_purged`). Write one new info `retention_purged` row per class with count > 0. Same-run trail rows stay. Second run is a no-op. No web route.

**Independent Test**: Spec US1 independent test (7y+1d security gone, 6y security kept, 3y+1d info gone including old deletion-trail, 2y info kept, new trail rows kept, second run adds none).

### Tests for User Story 1 ⚠️ fail first

- [x] T007 [P] [US1] Write failing integration tests in `tests/integration/retention-job.test.ts` for audit classes: frozen `now`; over-limit vs in-window security/info; old `retention_purged` aged out; new `retention_purged` from this run kept; metadata `{ class, count }` only (keys miss PII denylist in `lib/audit/write.ts`); second `runRetentionJob(now)` deletes 0 extra and writes 0 extra trail rows. Cite [contracts/job.md](./contracts/job.md) class order 1–2.

### Implementation for User Story 1

- [x] T008 [US1] Implement audit purge in `lib/retention/run.ts` (injected `now`, 7y security / 3y other, `writeAudit` same transaction, skip class if count 0). Do not delete the trail rows just inserted in this run.

**Checkpoint**: Spec US1 independent test passes. SC-001, SC-002, SC-003 for audit classes. FR-003–FR-005, FR-010–FR-011.

---

## Phase 4: User Story 2 - Shrink PII on long-deactivated accounts (Priority: P1)

**Goal**: Anonymize deactivated accounts past 3 years inactivity via `encryptPii` / `hmacEmailLookup` / `hashPassword`. Delete leftover directory copies, sessions, and reset tokens for those ids. Keep `users.id` and content attribution FKs. Skip already-sentinel rows.

**Independent Test**: Spec US2 independent test (eligible anonymized; in-window and active unchanged; leftover directory planted after deactivation gone; uploaded resource still names same id).

### Tests for User Story 2 ⚠️ fail first

- [x] T009 [P] [US2] Write failing unit tests in `tests/unit/retention-anonymize.test.ts` that replacements go through `encryptPii` / `hmacEmailLookup` (decrypt ≠ original email/name; lookup of original email no longer matches) and that a raw SQL plaintext bypass is not used
- [x] T010 [P] [US2] Extend failing fixtures in `tests/integration/retention-job.test.ts` for US2: eligible deactivated + leftover listing/shown/session/reset + resource `uploaded_by`; in-window deactivated; active; assert sentinel lookup, directory copies gone, sessions/reset gone, `uploaded_by` unchanged, one `retention_purged` with class `users_anonymized` and count 1; second run count 0

### Implementation for User Story 2

- [x] T011 [US2] Implement anonymization in `lib/retention/run.ts` (or `lib/retention/anonymize.ts` imported only from `run.ts` — do not add a second `authMode: "retention"`). Eligibility per [data-model.md](./data-model.md). Delete leftover directory/session/reset rows for those users only. Do not rewrite `resources.uploaded_by`, `events.host_user_id` / `created_by`, `announcements.created_by`.

**Checkpoint**: Spec US2 independent test passes. SC-004. FR-007, FR-014, FR-015 still holds (still one `authMode: "retention"`).

---

## Phase 5: User Story 3 - Clear leftover short-lived tokens (Priority: P2)

**Goal**: Delete expired or consumed password-reset tokens and expired or revoked invitations globally. Do not delete pending in-window invites or unused unexpired resets. Do not send invitation expiry mail.

**Independent Test**: Spec US3 independent test.

### Tests for User Story 3 ⚠️ fail first

- [x] T012 [P] [US3] Extend failing cases in `tests/integration/retention-job.test.ts` for expired/consumed resets gone, valid unused reset kept, expired+revoked invites gone, pending in-window invite kept; trail classes `password_reset_tokens` and `invitations` with matching counts

### Implementation for User Story 3

- [x] T013 [US3] Implement leftover token/invite DELETE in `lib/retention/run.ts` per [contracts/job.md](./contracts/job.md) class order 5–6. Do not call `sendLifecycleEmail`. Do not change `lib/registration/sweep.ts`.

**Checkpoint**: Spec US3 independent test passes. SC-005. FR-008, FR-009.

---

## Phase 6: User Story 4 - Age out product analytics events (Priority: P3)

**Goal**: 24-month analytics purge via `AnalyticsRetentionPort` (no Postgres event table). Default adapter returns 0. Tests inject an in-memory store. Trail class `analytics` only if count > 0. Do not `track()`.

**Independent Test**: Spec US4 independent test with injected port.

### Tests for User Story 4 ⚠️ fail first

- [x] T014 [P] [US4] Write failing tests in `tests/unit/retention-analytics.test.ts` for an in-memory `AnalyticsRetentionPort`: events older than 24 months removed, younger kept, return count
- [x] T015 [P] [US4] Extend `tests/integration/retention-job.test.ts` so an injected port count > 0 writes one `retention_purged` `{ class: "analytics", count }` and in-window `audit_log` rows are untouched; default adapter 0 writes no analytics trail row

### Implementation for User Story 4

- [x] T016 [US4] Add `AnalyticsRetentionPort` in `lib/analytics/retention.ts` (do not add purge logic to `lib/analytics/track.ts`). Default production adapter returns 0. Wire into `lib/retention/run.ts` (injected for tests). If the port throws, abort the transaction (no claiming trail row).

**Checkpoint**: Spec US4 independent test passes. SC-006. FR-006.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Local invoke, no HTTP, spec/quickstart gates.

- [x] T017 [P] Add `scripts/run-retention.ts` that only calls `runRetentionJob()` (no `authMode` literal) and add `"retention:run": "tsx scripts/run-retention.ts"` in `package.json`
- [x] T018 [P] Write failing unit test in `tests/unit/retention-no-http.test.ts` that `app/` contains no route/page importing `runRetentionJob`, then keep it green
- [x] T019 Confirm T002 item (6) still passes after US2–US4 (still exactly one `authMode: "retention"` under `lib/`+`app/`+`scripts/`) by running `pnpm test:rls` against `tests/rls/retention-policies.test.ts`
- [x] T020 Run [quickstart.md](./quickstart.md) commands: `pnpm test`, `pnpm test:rls`, `pnpm typecheck`, `pnpm lint` (do not require `pnpm test:a11y`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS US1–US4**
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; shares `lib/retention/run.ts` / `tests/integration/retention-job.test.ts` with US1 (implement after US1 if single-threaded)
- **US3 (Phase 5)**: Same shared job file; after US1 (tokens independent of anonymize, but same transaction)
- **US4 (Phase 6)**: After Foundational; port file is parallelizable; wiring touches `run.ts`
- **Polish (Phase 7)**: After desired stories

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependency on US2–US4
- **US2 (P1)**: After Phase 2 — independently testable; same `run.ts` as US1
- **US3 (P2)**: After Phase 2 — independently testable with token fixtures only
- **US4 (P3)**: After Phase 2 — independently testable with injected analytics port

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Job mutations before extra CLI/docs
- Story complete before next priority if sharing `run.ts`

### Parallel Opportunities

- T002 with nothing else until the file exists; then T003 / T004 / T005 in parallel
- T007 ∥ T009 ∥ T012 ∥ T014 (different concerns; T009/T012/T015 share `retention-job.test.ts` — do not parallel those three)
- T017 ∥ T018

---

## Parallel Example: Foundational

```bash
# After T002 exists (failing):
Task: "Migration GRANT/policies in prisma/migrations/"
Task: "authMode retention in lib/db/rls.ts"
Task: "retention_purged in lib/audit/actions.ts"
```

---

## Parallel Example: User Story 1

```bash
Task: "Failing audit fixtures in tests/integration/retention-job.test.ts"
# Then T008 implement purge in lib/retention/run.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational (T002 standalone RLS + scan is mandatory)
3. Phase 3 US1
4. **STOP and VALIDATE** US1 independent test
5. Demo: frozen-clock audit aging, no HTTP

### Incremental Delivery

1. Setup + Foundational → GUC + policies + stub job
2. US1 → audit aging (MVP)
3. US2 → anonymize
4. US3 → leftover tokens
5. US4 → analytics port
6. Polish → `pnpm retention:run` + no-HTTP proof

### Parallel Team Strategy

- After Phase 2: one person on US1 (`run.ts` audit), another on US4 port file (`lib/analytics/retention.ts`) without wiring until US1 lands
- US2/US3 serialize on `lib/retention/run.ts`

---

## Notes

- [P] = different files, no incomplete dependencies
- T002 item (6) is the explicit single-call-site assertion (FR-015)
- Verify tests fail before implementing
- Commit after each task or logical group
- `pnpm test:a11y` is out of scope (no pages)
- Avoid: second `withRls({ authMode: "retention" })`, HTTP cron route, editing invitation sweep mail, DEFINER plaintext PII, immortal deletion ledger
