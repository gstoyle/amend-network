# Tasks: Registration, Invitation & Approval

**Input**: Design documents from `/specs/003-registration-invitation-approval/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and spec FR-021 require test-first permission proof. Write the listed tests first and confirm they **fail** before implementation. Do not mock `requireRole` in tests whose purpose is to verify it.

**Organization**: Setup → Foundational (blocks all stories) → user stories in spec order (US1–US5) → polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US5) on story-phase tasks only
- Every task has a concrete file path

## Path Conventions

Repository-root Next.js app per plan.md (`app/`, `lib/`, `prisma/`, `tests/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and env for this slice. App scaffold already exists from `002-auth-rbac`.

- [x] T001 Add `csv-parse` in `package.json` and install so `pnpm-lock.yaml` updates
- [x] T002 [P] Add `ADMIN_ALERT_EMAIL` (env name only) in `.env.example` and validate it in `lib/env.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, RLS, token helper, audit enum, seed fixtures, email lifecycle hook, `authMode` values. **No user story work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US5

### Tests (fail first)

- [x] T003 [P] Write failing RLS tests for `users` INSERT/UPDATE WITH CHECK, `doc_affiliations` grants, and `invitations` isolation in `tests/rls/join-policies.test.ts`
- [x] T004 [P] Write failing unit tests for SHA-256 token hash and 32-byte random token in `tests/unit/token.test.ts`

### Implementation

- [x] T005 Define `DocAffiliation`, `Invitation`, User delta (`title_encrypted`, `doc_affiliation_id_encrypted`, `join_source`, `registration_ip`, `denial_reason_encrypted`) in `prisma/schema.prisma` per [data-model.md](./data-model.md)
- [x] T006 Add migration: tables, partial unique pending-invite index, `invitation_revoked` on `audit_log.action`, RLS/FORCE, grants, and policies from [contracts/rls-policies.md](./contracts/rls-policies.md) in `prisma/migrations/`
- [x] T007 Extend `authMode` with `registration` and `invite_lookup` in `lib/db/rls.ts`
- [x] T008 [P] Extract `hashToken` / `randomToken` from `lib/auth/password-reset.ts` into `lib/crypto/token.ts` and switch reset to import it
- [x] T009 [P] Add `invitation_revoked` to the allow-list in `lib/audit/actions.ts`
- [x] T010 [P] Add a lifecycle `sendLifecycleEmail` helper (kinds stubbed, json/smtp unchanged, tokens never logged) in `lib/email/transport.ts`
- [x] T011 Seed DOC fixtures `Test Agency A`, `Test Agency B` (active) and `Test Agency Inactive` (deactivated) in `prisma/seed.ts`

**Checkpoint**: `pnpm db:migrate` and `pnpm db:seed` succeed. Existing `002-auth-rbac` tests still pass. T003/T004 pass once policies and `lib/crypto/token.ts` exist. User stories may start.

---

## Phase 3: User Story 1 - Admin-managed DOC affiliation list (Priority: P1) 🎯 MVP

**Goal**: Admin/Super Admin add, edit label, and deactivate DOC values. Public forms offer **active** values only. No hard delete. Label edits apply to prior selections (encrypted id → current label).

**Independent Test**: As Admin, add two active values and deactivate one. Open `/register` signed out: only active values appear (no free-text). Moderator cannot open `/admin/users/affiliations`.

### Tests for User Story 1 ⚠️ fail first

- [x] T012 [P] [US1] Write failing add/edit/deactivate and public-active-list tests in `tests/integration/doc-affiliations.test.ts`
- [x] T013 [P] [US1] Write failing unauthorized deny for affiliations (Moderator, Pathways, LEAD, Pending) in `tests/app/unauthorized-routes.test.ts`

### Implementation for User Story 1

- [x] T014 [US1] Implement list/add/edit/deactivate (encrypt nothing on the list table; emit `system_setting_changed`) in `lib/registration/doc-affiliations.ts`
- [x] T015 [US1] Build presentational affiliation form (no role logic) in `components/doc-affiliation-form.tsx`
- [x] T016 [US1] Build `/admin/users/affiliations` with `requireRole({ admin: ["admin", "super_admin"], mfa: true })` in `app/(admin)/admin/users/affiliations/page.tsx`
- [x] T017 [US1] Build GET `/register` with active DOC dropdown only (no free text; submit comes in US2) in `app/(auth)/register/page.tsx`

**Checkpoint**: Spec US1 independent test passes. MVP demoable (vocabulary + public dropdown).

---

## Phase 4: User Story 2 - Self-registration into Pending (Priority: P1)

**Goal**: `/register` creates a Pending user, sends applicant confirmation (new emails only) and admin alert, always shows generic visitor copy. Duplicate emails do not leak state. Pending users still only reach the existing holding page.

**Independent Test**: New email + active DOC + launch network → pending user, two json mails, holding-page-only access. Resubmit `pathways@local` → same generic copy, no extra confirmation.

### Tests for User Story 2 ⚠️ fail first

- [x] T018 [P] [US2] Write failing new-email / duplicate-email / validation tests in `tests/integration/register.test.ts`
- [x] T019 [P] [US2] Write failing tests that visitor copy is identical for new vs existing accounts in `tests/unit/register-copy.test.ts`

### Implementation for User Story 2

- [x] T020 [US2] Implement self-register (`auth_mode=registration`, HMAC uniqueness, encrypt title + affiliation id, `join_source=self_registered`, `registration_submitted` only for new users) in `lib/registration/register.ts`
- [x] T021 [US2] Complete register submit UI (password ≥ 12, network dropdown, CSRF) in `components/register-form.tsx` and `app/(auth)/register/page.tsx`
- [x] T022 [US2] Show Sign in + Request access when unauthenticated in `app/page.tsx` (authenticated still redirects to `/app` or `/app/pending`)
- [x] T023 [US2] Send applicant confirmation and `ADMIN_ALERT_EMAIL` pending alert (no DOC in analytics; no second confirmation on duplicates) in `lib/email/transport.ts` via `lib/registration/register.ts`

**Checkpoint**: Spec US2 independent test passes. FR-001–FR-004.

---

## Phase 5: User Story 3 - Approval queue (Priority: P1)

**Goal**: Admin/Super Admin see pending oldest-first, filter by network, view submitted fields + IP, approve (optional network override) or deny (reason encrypted, polite email with no reason).

**Independent Test**: Two pending users on different networks; filter; approve one; deny the other with a reason. Approved reaches `/app`. Denied cannot sign in. Moderator denied the queue.

### Tests for User Story 3 ⚠️ fail first

- [x] T024 [P] [US3] Write failing approve/deny/concurrent-second-decision tests in `tests/integration/approve.test.ts`
- [x] T025 [P] [US3] Mark `approve_deny_registrations` built (A for Admin/Super Admin) in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`
- [x] T026 [P] [US3] Write failing unauthorized deny for `/admin/users/pending` in `tests/app/unauthorized-routes.test.ts`

### Implementation for User Story 3

- [x] T027 [US3] Implement approve/deny (conditional `status=pending` update, `role_assigned` + `registration_approved`/`registration_denied`, encrypt deny reason, never put reason in audit metadata) in `lib/registration/approve.ts`
- [x] T028 [US3] Build pending queue UI (oldest-first, network filter, IP or “unavailable”) in `app/(admin)/admin/users/pending/page.tsx` and `components/pending-queue.tsx`
- [x] T029 [US3] Send welcome or set-password-on-approve, and polite denial with no reason, from `lib/registration/approve.ts` using `lib/email/transport.ts`
- [x] T030 [US3] Link pending / invite / affiliations from `app/(admin)/admin/page.tsx`

**Checkpoint**: Spec US3 independent test passes. Matrix approve/deny is A not FC.

---

## Phase 6: User Story 4 - Admin invitation and invite tokens (Priority: P1)

**Goal**: Manual + CSV invite (≤ 500 rows). Hashed 14-day single-use tokens. Completion creates an **active** member (no pending). Consumed token shows PRD used-copy. Email locked; name/network pre-filled.

**Independent Test**: Manual invite + mixed CSV; only valid rows send; complete once → active member; second click = already used; Moderator denied `/admin/users/invite`.

### Tests for User Story 4 ⚠️ fail first

- [x] T031 [P] [US4] Write failing CSV header/row/limit/duplicate tests in `tests/unit/csv.test.ts`
- [x] T032 [P] [US4] Write failing manual + mixed-CSV send tests in `tests/integration/invite-send.test.ts`
- [x] T033 [P] [US4] Write failing complete / consumed / expired-shaped / signed-in-refuse tests in `tests/integration/invite-complete.test.ts`
- [x] T034 [P] [US4] Write failing unauthorized deny for `/admin/users/invite` in `tests/app/unauthorized-routes.test.ts`

### Implementation for User Story 4

- [x] T035 [US4] Implement RFC4180 parse + validation (exact headers, active DOC label, launch networks, pending-invite uniqueness) in `lib/registration/csv.ts`
- [x] T036 [US4] Implement send (hashed token, 14-day expiry, `invitation_sent`, `bulk_invite_sent` if ≥ 2) and complete (`invite_lookup`, active user, `invitation_accepted` + `role_assigned`) in `lib/registration/invite.ts`
- [x] T037 [US4] Build admin invite UI (manual + CSV error report) in `app/(admin)/admin/users/invite/page.tsx` and `components/invite-form.tsx`
- [x] T038 [US4] Build `/invite/[token]` (pre-fill, email locked, refuse if session exists) in `app/(auth)/invite/[token]/page.tsx` and `components/invite-complete-form.tsx`
- [x] T039 [US4] Send invite email with `${AUTH_URL}/invite/${token}` and 14-day copy from `lib/registration/invite.ts` via `lib/email/transport.ts`

**Checkpoint**: Spec US4 independent test passes. FR-005–FR-009, FR-023.

---

## Phase 7: User Story 5 - Invite expiry, reminders, revoke, re-issue (Priority: P2)

**Goal**: Unused invites expire at 14 days; 3-day reminder to invitee + inviter; expiry notice to inviter; admin can revoke unused and re-issue (new token; old hash dead).

**Independent Test**: Frozen `now` expires a pending invite; reminder fires at T-3d; revoke kills the link; re-issue works; old token still fails.

### Tests for User Story 5 ⚠️ fail first

- [x] T040 [US5] Write failing sweep / reminder / revoke / re-issue tests (inject `now`) in `tests/integration/invite-lifecycle.test.ts`

### Implementation for User Story 5

- [x] T041 [US5] Implement `runInvitationSweep(now)` (expire + remind; `invitation_expired`) in `lib/registration/sweep.ts`
- [x] T042 [US5] Implement revoke (`invitation_revoked`) and re-issue (new row + `invitation_sent`) in `lib/registration/invite.ts`
- [x] T043 [US5] Add outstanding-invite list, revoke, and re-issue controls in `app/(admin)/admin/users/invite/page.tsx`
- [x] T044 [US5] Send expiring-soon and expired-unused notices from `lib/registration/sweep.ts` via `lib/email/transport.ts`

**Checkpoint**: Spec US5 independent test passes. FR-016. Production cron wiring stays out of scope.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: A11y, secrets hygiene, extra matrix/RLS asserts, quickstart proof.

- [x] T045 [P] Add axe-core coverage for `/register`, `/invite/[token]`, pending, invite, and affiliations in `tests/a11y/join-pages.test.ts`
- [x] T046 [P] Assert logs never contain raw invite tokens, password hashes, or DOC plaintext in `tests/unit/no-secrets-in-logs.test.ts`
- [x] T047 [P] Assert new audit metadata keys stay off the PII denylist in `tests/unit/audit-metadata.test.ts`
- [x] T048 Extend extra invite/DOC deny assertions (app + RLS) in `tests/app/permission-matrix.test.ts` and `tests/rls/join-policies.test.ts`
- [x] T049 Run [quickstart.md](./quickstart.md) (`pnpm db:migrate`, `pnpm db:seed`, `pnpm test`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: After Phase 2 — MVP
- **US2 (Phase 4)**: After US1 (`app/(auth)/register/page.tsx` overlap)
- **US3 (Phase 5)**: After US2 (needs pending users)
- **US4 (Phase 6)**: After US1 (active DOC vocabulary). Can overlap US3 on different files (`invite.ts` vs `approve.ts`)
- **US5 (Phase 7)**: After US4 (needs invitation rows + `lib/registration/invite.ts`)
- **Polish (Phase 8)**: After stories intended for the increment

### User Story Dependencies

- **US1**: After Phase 2 only
- **US2**: After US1 (register page + DOC dropdown)
- **US3**: After US2 (pending records to queue)
- **US4**: After US1; file-independent from US3 except shared unauthorized-routes test
- **US5**: After US4

### Within Each User Story

- Tests MUST be written and fail before implementation
- Do not mock `requireRole` in role tests
- Story complete before the next priority unless parallel staffing (US3 ∥ US4 after US1/US2 as noted)

### Parallel Opportunities

- T001 then T002
- T003 and T004 together
- T008, T009, T010 after T005 (T006/T007 sequential with T005)
- T012 and T013 together
- T018 and T019 together
- T024, T025, T026 together
- T031–T034 together
- After US2: US3 and US4 on different modules if two implementers (`approve.ts` vs `invite.ts`/`csv.ts`)
- T045, T046, T047 together

---

## Parallel Example: User Story 1

```text
T012 tests/integration/doc-affiliations.test.ts
T013 tests/app/unauthorized-routes.test.ts
```

## Parallel Example: User Story 4 tests

```text
T031 tests/unit/csv.test.ts
T032 tests/integration/invite-send.test.ts
T033 tests/integration/invite-complete.test.ts
T034 tests/app/unauthorized-routes.test.ts
```

## Parallel Example: After US2 (if staffed)

```text
US3  T024–T030  lib/registration/approve.ts, pending page
US4  T031–T039  lib/registration/invite.ts, csv.ts, invite pages
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup
2. Phase 2 Foundational (critical)
3. Phase 3 US1
4. **STOP and VALIDATE** spec US1 independent test (DOC list + `/register` dropdown)

### Recommended join increment (before content slices)

US1 + US2 + US3 so a person can request access and be approved. Then US4–US5 for cohort invite.

### Incremental Delivery

1. Setup + Foundational
2. US1 → demo DOC list
3. US2 → self-register / pending
4. US3 → approve/deny
5. US4 → bulk invite + tokens
6. US5 → expiry / revoke / re-issue
7. Polish / quickstart

---

## Notes

- Cite PRD §5.2 / §3 / §6 and Constitution I, II, IV in the change that implements each FR
- `lib/registration/` is new because join-flow is not an extension of `lib/auth/` (research §7)
- Q2 remains a named developer assumption (controlled list, unconfirmed by Amend)
- Q3 remains Pathways and LEAD only
- Do not add Postmark, directory privacy, Network CRUD, or production cron
- Commit after each task or logical group if the operator asks for commits
