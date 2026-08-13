# Tasks: Authentication & Role-Based Access Control

**Input**: Design documents from `/specs/002-auth-rbac/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and spec FR-025 / FR-026 require test-first permission proof. Write the listed tests first and confirm they **fail** before implementation.

**Organization**: Setup → Foundational (blocks all stories) → user stories in spec order → polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US8) on story-phase tasks only
- Every task has a concrete file path

## Path Conventions

Repository-root Next.js app per plan.md (`app/`, `lib/`, `prisma/`, `tests/`, `middleware.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: First application scaffold. No auth behavior yet.

- [x] T001 Scaffold Next.js 15 App Router, TypeScript strict, `output: 'standalone'`, pnpm in `package.json`, `next.config.ts`, `tsconfig.json`, and `app/layout.tsx`
- [x] T002 [P] Add Tailwind and CSS custom-property tokens (no hard-coded colours) in `app/globals.css` and `tailwind.config.ts`
- [x] T003 [P] Add local Postgres 16 with `amend_owner` and `amend_app` roles in `docker-compose.yml` and `docker/postgres/init.sql`
- [x] T004 [P] Document env names only (no secrets) in `.env.example` and ignore `.env` in `.gitignore`
- [x] T005 Add `lint`, `typecheck`, `test`, `test:rls`, `test:a11y`, `db:migrate`, `db:seed` scripts in `package.json` and Vitest in `vitest.config.ts`
- [x] T006 [P] Add ESLint flat config in `eslint.config.mjs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, crypto, session primitives, `requireRole`, middleware, audit writer, Auth.js wiring, seeds. **No user story work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US8

### Tests (fail first)

- [x] T007 [P] Write failing unit tests for AES-256-GCM encrypt/decrypt and HMAC email lookup in `tests/unit/pii.test.ts`
- [x] T008 [P] Write failing unit tests that `requireRole` denies a missing session in `tests/unit/require-role.test.ts`

### Implementation

- [x] T009 Implement PII helpers (new module; no existing crypto helper) in `lib/crypto/pii.ts`
- [x] T010 Implement Argon2id hash and verify in `lib/auth/password.ts`
- [x] T011 Define Network, User, Session, PasswordResetToken, AuthThrottle, AuditLog, VisibilityRecord in `prisma/schema.prisma` per `specs/002-auth-rbac/data-model.md`
- [x] T012 Add RLS, `FORCE ROW LEVEL SECURITY`, `app_role_tokens()`, GIN on `visibility`, and INSERT-only `audit_log` grants in `prisma/migrations/`
- [x] T013 Implement `amend_app` and `amend_owner` Prisma clients in `lib/db/prisma.ts` and `lib/db/migrator.ts`
- [x] T014 Implement transaction-local GUC `set_config` extension in `lib/db/rls.ts`
- [x] T015 Validate env with Zod (connection strings and keys from env only) in `lib/env.ts`
- [x] T016 Implement the single generic auth-failure copy in `lib/auth/errors.ts`
- [x] T017 Implement session create/load/revoke (opaque id, 24h sliding, 30d absolute, no cookie Max-Age) in `lib/auth/session.ts`
- [x] T018 Implement `requireRole` from the loaded session (ignore client role fields) in `lib/auth/requireRole.ts`
- [x] T019 Implement append-only writer and full PRD §6 action enum in `lib/audit/write.ts` and `lib/audit/actions.ts`
- [x] T020 Configure Auth.js v5 Credentials (JWT cookie envelope = session id only) in `auth.ts` and `app/api/auth/[...nextauth]/route.ts`
- [x] T021 Require a session for `/app/*` and `/admin/*` (redirect to `/login`) in `middleware.ts`
- [x] T022 Seed eight local users, two networks, and visibility fixtures from `SEED_PASSWORD` env in `prisma/seed.ts`
- [x] T023 Add presentational shadcn Button, Input, Label (no role logic) in `components/ui/button.tsx`, `components/ui/input.tsx`, and `components/ui/label.tsx`
- [x] T024 Add authenticated layouts with a log-out slot in `app/(member)/layout.tsx` and `app/(admin)/layout.tsx`

**Checkpoint**: `pnpm db:migrate` and `pnpm db:seed` succeed against local Postgres. Unit tests for PII and `requireRole` pass. User stories may start.

---

## Phase 3: User Story 1 - Sign in, session rules, sign out (Priority: P1) 🎯 MVP

**Goal**: Approved members sign in with email/password, get a revocable server-side session, see `/app`, and sign out. No remember-me. Cookie dies on browser close.

**Independent Test**: Seed `pathways@local`, sign in, see home, sign out, `/app` redirects to `/login`. No remember-me control. Session cookie has no Max-Age.

### Tests for User Story 1 ⚠️ fail first

- [ ] T025 [P] [US1] Write failing integration tests for sign-in success, generic failure, and logout in `tests/integration/sign-in.test.ts`
- [ ] T026 [P] [US1] Write failing tests for httpOnly/Secure/SameSite=Lax and no Max-Age in `tests/integration/session-cookie.test.ts`

### Implementation for User Story 1

- [ ] T027 [US1] Implement Credentials `authorize` (HMAC lookup, Argon2id, deny denied/deactivated/unknown with generic copy) in `lib/auth/credentials.ts`
- [ ] T028 [US1] Build `/login` with no remember-me control in `app/(auth)/login/page.tsx` and `components/login-form.tsx`
- [ ] T029 [US1] Build member home calling `requireRole` before data in `app/(member)/app/page.tsx`
- [ ] T030 [US1] Implement log-out control and server action that revokes the session row in `components/logout-button.tsx` and `lib/auth/actions.ts`
- [ ] T031 [US1] Emit `login_success`, `login_failure`, and `logout` in the same transaction as the change from `lib/auth/credentials.ts` and `lib/auth/actions.ts`
- [ ] T032 [US1] Redirect `/` to `/app` or `/login` in `app/page.tsx`

**Checkpoint**: US1 independent test in spec.md passes. MVP demoable.

---

## Phase 4: User Story 2 - Three-layer authorization (Priority: P1)

**Goal**: Unauthenticated visitors cannot reach `/app` or `/admin`. `requireRole` uses the signed session. Visibility intersection plus native RLS. Unbuilt matrix rows fail closed.

**Independent Test**: Pathways user sees 0 LEAD-only fixture rows (and reverse). Same result via `pnpm test:rls` with the app bypassed. Client-supplied role does not increase visibility.

### Tests for User Story 2 ⚠️ fail first

- [ ] T033 [P] [US2] Write failing app permission-matrix tests (`requireRole` not mocked) in `tests/app/permission-matrix.test.ts`
- [ ] T034 [P] [US2] Write failing RLS matrix tests (GUCs only, no `requireRole`) in `tests/rls/permission-matrix.test.ts`
- [ ] T035 [P] [US2] Write failing tests that client-supplied roles are ignored in `tests/integration/client-role.test.ts`

### Implementation for User Story 2

- [ ] T036 [US2] Implement visibility filter helper (query WHERE **and** RLS) in `lib/db/visibility.ts`
- [ ] T037 [US2] Load fixture records through `lib/db/visibility.ts` on `app/(member)/app/page.tsx`
- [ ] T038 [US2] Run RLS tests as `amend_app` via `pnpm test:rls` in `package.json` and `tests/rls/vitest.rls.config.ts`
- [ ] T039 [US2] Add unauthorized-role deny tests for each handler delivered so far in `tests/app/unauthorized-routes.test.ts`

**Checkpoint**: SC-002 / SC-003 style assertions green on both matrix runs.

---

## Phase 5: User Story 3 - Administrative MFA (Priority: P1)

**Goal**: Super Admin / Admin / Moderator must enroll TOTP before any `/admin` route. Session `mfa_satisfied` required. Members are not prompted on member routes.

**Independent Test**: `admin@local` (MFA off) is blocked from `/admin` until enroll + code. Wrong code denied + `mfa_challenge_failed` audit. Pathways member is not asked for MFA.

### Tests for User Story 3 ⚠️ fail first

- [ ] T040 [P] [US3] Write failing enroll/challenge tests in `tests/integration/mfa.test.ts`
- [ ] T041 [P] [US3] Write failing `/admin` deny-without-`mfa_satisfied` tests in `tests/app/admin-mfa.test.ts`

### Implementation for User Story 3

- [ ] T042 [US3] Implement TOTP generate/verify (`otpauth`) in `lib/auth/totp.ts`
- [ ] T043 [US3] Build enrollment UI and actions in `app/(auth)/mfa/enroll/page.tsx` and `lib/auth/mfa-actions.ts`
- [ ] T044 [US3] Build challenge UI in `app/(auth)/mfa/challenge/page.tsx`
- [ ] T045 [US3] Build admin placeholder with `requireRole({ admin: [...], mfa: true })` in `app/(admin)/admin/page.tsx`
- [ ] T046 [US3] Redirect `/admin/*` to enroll or challenge unless `mfa_satisfied` in `middleware.ts`
- [ ] T047 [US3] Emit `mfa_enrolled` and `mfa_challenge_failed` from `lib/auth/mfa-actions.ts`

**Checkpoint**: Admin area unreachable without MFA; member routes unchanged.

---

## Phase 6: User Story 4 - Append-only audit trail (Priority: P1)

**Goal**: Auth events persist in PRD §6 schema. No updates/deletes. Super Admin reads full history; Admin last 90 days; others denied.

**Independent Test**: Sign-in success/failure produce rows. UPDATE/DELETE as `amend_app` fail. Member cannot read the log; Admin 90d; Super Admin full.

### Tests for User Story 4 ⚠️ fail first

- [ ] T048 [P] [US4] Write failing same-transaction and append-only tests in `tests/integration/audit-writer.test.ts`
- [ ] T049 [P] [US4] Write failing audit-read tests (app + RLS) in `tests/app/audit-read.test.ts` and `tests/rls/audit-read.test.ts`
- [ ] T050 [P] [US4] Write failing metadata PII-denylist tests in `tests/unit/audit-metadata.test.ts`

### Implementation for User Story 4

- [ ] T051 [US4] Implement role-gated audit query (90d vs full) in `lib/audit/read.ts`
- [ ] T052 [US4] Build paginated audit viewer (no export) in `app/(admin)/admin/audit-log/page.tsx`
- [ ] T053 [US4] Extend unauthorized deny coverage for audit read in `tests/app/unauthorized-routes.test.ts`

**Checkpoint**: FR-017–FR-020 covered. Writer already in Phase 2; this story proves it and adds read.

---

## Phase 7: User Story 5 - Lockout (Priority: P2)

**Goal**: 10 failures in 15 minutes lock 15 minutes. Same generic message. Security audit row. Unknown emails throttled via HMAC key.

**Independent Test**: 11th attempt refused; copy identical to unknown email; security-severity audit row.

### Tests for User Story 5 ⚠️ fail first

- [ ] T054 [US5] Write failing lockout and enumeration tests in `tests/integration/lockout.test.ts`

### Implementation for User Story 5

- [ ] T055 [US5] Implement throttle keyed by email HMAC in `lib/auth/throttle.ts`
- [ ] T056 [US5] Call throttle from `lib/auth/credentials.ts` and emit security-severity audit on lock

**Checkpoint**: FR-013 / SC-006.

---

## Phase 8: User Story 6 - Password reset (Priority: P2)

**Goal**: Always-success request UX. 60-minute single-use token. Completion revokes all sessions. Unknown email → distinct audit only.

**Independent Test**: Reset known seed user; old sessions dead. Unknown email: success UX + distinct audit. Expired/consumed token fails.

### Tests for User Story 6 ⚠️ fail first

- [ ] T057 [US6] Write failing reset request/complete/unknown/expired tests in `tests/integration/password-reset.test.ts`

### Implementation for User Story 6

- [ ] T058 [US6] Implement json/smtp Nodemailer transports (tokens never logged) in `lib/email/transport.ts`
- [ ] T059 [US6] Implement request/complete (hash token, revoke all sessions, audit) in `lib/auth/password-reset.ts`
- [ ] T060 [US6] Build forgot/reset pages in `app/(auth)/forgot-password/page.tsx` and `app/(auth)/reset-password/page.tsx`

**Checkpoint**: FR-014 / SC-007.

---

## Phase 9: User Story 7 - Concurrent sessions and revoke (Priority: P2)

**Goal**: Multiple sessions listed; revoke one without killing the others; `session_revoked` audit.

**Independent Test**: Two sessions; revoke one; revoked dead; other valid.

### Tests for User Story 7 ⚠️ fail first

- [ ] T061 [US7] Write failing list-and-revoke tests in `tests/integration/sessions.test.ts`

### Implementation for User Story 7

- [ ] T062 [US7] Implement list/revoke (own rows only) in `lib/auth/session-actions.ts`
- [ ] T063 [US7] Build active-sessions page in `app/(member)/app/profile/sessions/page.tsx`

**Checkpoint**: FR-005 / SC-005 for revoke.

---

## Phase 10: User Story 8 - Pending holding vs silent denial (Priority: P3)

**Goal**: Pending + correct password → holding page only. Denied/deactivated/unknown/wrong password share generic failure.

**Independent Test**: `pending@local` → `/app/pending` and 0 fixture rows. `denied@local` / `deactivated@local` → generic failure, no session.

### Tests for User Story 8 ⚠️ fail first

- [ ] T064 [US8] Write failing pending/denied/deactivated tests in `tests/integration/pending-status.test.ts`

### Implementation for User Story 8

- [ ] T065 [US8] Build holding page in `app/(member)/app/pending/page.tsx`
- [ ] T066 [US8] Redirect pending sessions away from other `/app/*` routes in `middleware.ts` and `lib/auth/requireRole.ts`

**Checkpoint**: FR-015 / FR-016 / SC-011.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: A11y, secrets hygiene, full matrix fail-closed rows, quickstart proof.

- [ ] T067 [P] Add axe-core coverage for login, pending, sessions, MFA, and admin pages in `tests/a11y/auth-pages.test.ts`
- [ ] T068 [P] Assert logs never contain secrets, hashes, TOTP secrets, or reset tokens in `tests/unit/no-secrets-in-logs.test.ts`
- [ ] T069 Fill remaining fail-closed PRD §3 rows in `tests/app/permission-matrix.test.ts` and `tests/rls/permission-matrix.test.ts`
- [ ] T070 Run [quickstart.md](./quickstart.md) (`docker compose`, migrate, seed, `pnpm test`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: After Phase 2 — MVP
- **US2 (Phase 4)**: After Phase 2; overlaps `app/(member)/app/page.tsx` with US1 → do after US1 if one implementer
- **US3 (Phase 5)**: After US1 (needs a working session)
- **US4 (Phase 6)**: Writer exists in Phase 2; admin read UI needs US3 MFA
- **US5–US7 (Phases 7–9)**: After US1 (credentials/session). US5–US7 can proceed in parallel with each other
- **US8 (Phase 10)**: After US1; visibility hide also needs US2
- **Polish (Phase 11)**: After stories intended for the increment

### User Story Dependencies

- **US1**: After Phase 2 only
- **US2**: After Phase 2; file overlap with US1 home page
- **US3**: After US1
- **US4**: After Phase 2 for writer tests; after US3 for `/admin/audit-log`
- **US5**: After US1 (`lib/auth/credentials.ts`)
- **US6**: After US1
- **US7**: After US1
- **US8**: After US1; after US2 for fixture hiding on pending

### Within Each User Story

- Tests MUST be written and fail before implementation
- Do not mock `requireRole` in tests that exist to verify it
- Story complete before the next priority unless parallel staffing

### Parallel Opportunities

- T002, T003, T004, T006 after T001
- T007 and T008 together
- T025 and T026 together
- T033, T034, T035 together
- T040 and T041 together
- T048, T049, T050 together
- After US1: US5, US6, US7 on different files (`throttle.ts` / `password-reset.ts`+email / `session-actions.ts`)
- T067 and T068 together

---

## Parallel Example: User Story 2

```text
T033 tests/app/permission-matrix.test.ts
T034 tests/rls/permission-matrix.test.ts
T035 tests/integration/client-role.test.ts
```

## Parallel Example: After US1 (P2 stories)

```text
T054 + T055–T056  lockout   lib/auth/throttle.ts
T057 + T058–T060  reset     lib/email/transport.ts, lib/auth/password-reset.ts
T061 + T062–T063  sessions  lib/auth/session-actions.ts
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup
2. Phase 2 Foundational (critical)
3. Phase 3 US1
4. **STOP and VALIDATE** spec US1 independent test

### Constitution-complete auth increment (recommended before content slices)

US1 + US2 + US3 + US4 (session, three layers, MFA, audit). Then US5–US8.

### Incremental Delivery

1. Setup + Foundational
2. US1 → demo sign-in/out
3. US2 → matrix + RLS
4. US3 → admin MFA
5. US4 → audit read + append-only proof
6. US5–US7 in parallel if staffed
7. US8 pending/denial
8. Polish / quickstart

---

## Notes

- Cite PRD §5.1 / §4 / §6 and Constitution I, II, IV in the change that implements each FR
- `lib/crypto/pii.ts` is new because no crypto helper existed
- Do not introduce Clerk, Redis, or Prisma Postgres `@@rls`
- Q3 remains Pathways and LEAD only
- Commit after each task or logical group if the operator asks for commits
