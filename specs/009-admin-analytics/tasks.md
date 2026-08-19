# Tasks: Admin Analytics Dashboard

**Input**: Design documents from `/specs/009-admin-analytics/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and spec FR-020 require test-first permission proof. Write the listed tests first and confirm they **fail** before implementation. Do not mock `requireRole` in tests whose purpose is to verify it.

**Organization**: Setup → Foundational (blocks all stories) → user stories in spec order (US1–US5) → polish.

**Read-only slice.** No new tables/columns. No change to `audit_log` SELECT. No new audit actions or PostHog events. k=3 is hardcoded inside `admin_analytics_snapshot` ([research.md](./research.md) §6a); it is **not** a function argument.

**Standalone EXECUTE**: T002 is its own task and file. Do **not** fold it into a generic analytics RLS suite. Helper-path tests do not satisfy T002.

**k=3 / top-10 events**: Named assumption (`docs/decisions/assumptions-log.md`, 2026-08-18). Unconfirmed by Amend.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US5) on story-phase tasks only
- Every task has a concrete file path

## Path Conventions

Repository-root Next.js app per plan.md (`app/`, `lib/`, `prisma/`, `tests/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new packages. Confirm ignore files already cover Node/Docker/env from prior slices.

- [x] T001 Verify `.gitignore`, `.dockerignore`, and `eslint.config.mjs` `ignores` already include `node_modules/`, `dist/`, `.env*`, `*.log` (append only if a required pattern is missing)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `admin_analytics_snapshot(uuid)` with GUC gate, k=3 omission then LIMIT 10 on both leaderboards, identical Admin/Super Admin JSON. **No user story work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US5

### Tests (fail first)

- [x] T002 [P] Write failing tests in `tests/rls/admin-analytics-snapshot.test.ts` that (1) `SELECT admin_analytics_snapshot(NULL)` as `amend_app` (raw SQL `EXECUTE`, **not** `lib/admin-analytics`), with caller GUCs for Super Admin **and** Admin, and assert JSON KPI/funnel numbers are **equal**; (2) the same `EXECUTE` as Moderator, Pathways, LEAD, pending returns an empty/denied payload (no counts); (3) as Admin, `SELECT` from `audit_log` still returns **0** rows older than 90 days in the same fixture that the snapshot used for first-login/retention; (4) a live resource with `download_count` 1 or 2 and an uncancelled event with 1 or 2 Yes RSVPs are **absent** from `topResources` / `topEvents` (omission, not a zeroed row), while count ≥ 3 appears; (5) `topEvents` length ≤ 10. Cite [contracts/rls-policies.md](./contracts/rls-policies.md) § Direct EXECUTE `admin_analytics_snapshot` and [research.md](./research.md) §6a. This task MUST stay standalone.
- [x] T003 [P] Write failing unit tests in `tests/unit/admin-analytics-snapshot.test.ts` that `admin_analytics_snapshot(uuid)` is a single SQL function (`pg_proc`), that it takes **exactly one** argument (k is not a parameter), and that `REVOKE`/`GRANT EXECUTE` to `amend_app` matches [contracts/rls-policies.md](./contracts/rls-policies.md)

### Implementation

- [x] T004 Add migration in `prisma/migrations/` that creates `admin_analytics_snapshot(p_network_id uuid)` as `SECURITY DEFINER`, `SET search_path = pg_catalog, public`, GUC check `admin`/`super_admin` else `'{}'::jsonb`, JSON shape from [data-model.md](./data-model.md), funnel stages from [research.md](./research.md) §3, leaderboards with **hardcoded** `count >= 3` then `LIMIT 10` for resources **and** events ([research.md](./research.md) §6a), `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO amend_app`. Do **not** ALTER `audit_log` or any existing table. Do **not** add `authMode`.
- [x] T005 Add TypeScript snapshot types in `lib/admin-analytics/types.ts` matching [data-model.md](./data-model.md) (kpis, funnel including `retentionEligible`/`retained`, `topResources`, `topEvents`)

**Checkpoint**: `pnpm db:migrate` succeeds. T002/T003 pass. Existing `002`–`008` tests still pass. User stories may start.

---

## Phase 3: User Story 1 - Read top-line health at a glance (Priority: P1) 🎯 MVP

**Goal**: MFA-satisfied Super Admin and Admin see four KPI cards on `/admin/analytics` and `/admin` (approved members, MAM + Pathways/LEAD split, pending, live content counts). Moderator keeps `/admin` nav with **0** KPI numbers. Opening analytics writes no new audit action types and does not call `track()`.

**Independent Test**: Seed known approved members (some signed in this UTC month), pending, live vs withdrawn resources, cancelled vs live events, current announcements. Cards match a hand count. Moderator and Pathways cannot see numbers.

### Tests for User Story 1 ⚠️ fail first

- [x] T006 [P] [US1] Write failing KPI count / MAM split / withdrawn-omitted / staff-only-excluded tests in `tests/integration/admin-analytics-kpis.test.ts`
- [x] T007 [P] [US1] Write failing unauthorized deny for `/admin/analytics` (Moderator, Pathways, LEAD, pending, signed-out, Admin without `mfa_satisfied`) in `tests/app/unauthorized-routes.test.ts`
- [x] T008 [P] [US1] Mark `view_analytics` built in `tests/helpers/prd-matrix.ts` (Super Admin/Admin **A**, others D), `tests/app/permission-matrix.test.ts` (`isBuilt` + `appAllows` calling the load helper with MFA for Admin), and `tests/rls/permission-matrix.test.ts` (EXECUTE snapshot: Admin/Super Admin have `kpis`, Moderator `{}`) per [contracts/permission-matrix.md](./contracts/permission-matrix.md)

### Implementation for User Story 1

- [x] T009 [US1] Implement `loadAdminAnalytics(session, networkId | null)` in `lib/admin-analytics/load.ts`: `requireRole({ admin: ['admin','super_admin'], mfa: true })`, `withRls`, `$queryRaw` `SELECT admin_analytics_snapshot($1)`, ignore client-supplied roles, **do not** call `track()`
- [x] T010 [US1] Build presentational KPI cards (no role logic) in `components/admin-kpi-cards.tsx`
- [x] T011 [US1] Build `/admin/analytics` in `app/(admin)/admin/analytics/page.tsx` showing KPI cards only in this story; `requireRole` as [contracts/analytics-http.md](./contracts/analytics-http.md)
- [x] T012 [US1] Show the same four cards on `app/(admin)/admin/page.tsx` only after a successful Admin/Super Admin role check; Moderator must not receive aggregates
- [x] T013 [US1] Add Analytics (and keep Audit log) links on `app/(admin)/layout.tsx` and `app/(admin)/admin/page.tsx` using tokens only

**Checkpoint**: Spec US1 independent test passes. SC-001 / SC-002.

---

## Phase 4: User Story 2 - Inspect the join-to-return funnel by network (Priority: P2)

**Goal**: `/admin/analytics` shows five funnel stages (invitation → registration → approval → first login → 30-day retention) with `retentionEligible` / `retained` so in-window members are not drop-offs. Optional `network` query (`all` or network uuid) maps to `p_network_id`.

**Independent Test**: Seed Pathways invite completed + two logins over 31 days, LEAD self-reg still pending, approved member who never signed in. Filter by each network; stage counts match [research.md](./research.md) §3.

### Tests for User Story 2 ⚠️ fail first

- [x] T014 [P] [US2] Write failing invite vs self-reg / pending-not-approved / not-yet-eligible / network-filter tests in `tests/integration/admin-analytics-funnel.test.ts`

### Implementation for User Story 2

- [x] T015 [US2] Build presentational funnel (no role logic; network control is a leaf) in `components/admin-funnel.tsx`
- [x] T016 [US2] Wire `network` query on `app/(admin)/admin/analytics/page.tsx` into `loadAdminAnalytics` per [contracts/analytics-http.md](./contracts/analytics-http.md); unknown id → empty funnel, no stack trace

**Checkpoint**: Spec US2 independent test passes. SC-004.

---

## Phase 5: User Story 3 - See which resources and events members actually use (Priority: P2)

**Goal**: Leaderboards on `/admin/analytics`: top 10 live resources with **≥ 3** downloads; top 10 uncancelled events with **≥ 3** Yes RSVPs. Below-threshold items omitted entirely. No forum threads, no flag counts. Empty state when none qualify.

**Independent Test**: Live resources with 1, 2, and ≥3 downloads; withdrawn with high count; events with 1, 2, ≥3 Yes plus cancelled. UI lists only ≥3, caps at 10, omits withdrawn/cancelled/below-k titles, no thread list.

### Tests for User Story 3 ⚠️ fail first

- [x] T017 [P] [US3] Write failing k=3 omission / max-10 / withdrawn-cancelled-omitted / empty-state / no-forum tests in `tests/integration/admin-analytics-leaderboards.test.ts`

### Implementation for User Story 3

- [x] T018 [US3] Build presentational leaderboards (no role logic; empty state; no flag/thread section) in `components/admin-leaderboards.tsx` and render them on `app/(admin)/admin/analytics/page.tsx`

**Checkpoint**: Spec US3 independent test passes. SC-005.

---

## Phase 6: User Story 4 - Review the audit trail with filters (Priority: P1)

**Goal**: `/admin/audit-log` stays Super Admin / Admin + MFA. Paginated. Filterable by actor uuid, action, date range, severity. Admin still clipped to 90 days even if `from` is older. Viewer GET writes one `audit_log_viewed` in the same transaction. Columns match [data-model.md](./data-model.md) (no `metadata`).

**Independent Test**: Mixed actions/actors/dates including 91 days ago. Admin never sees the old row. Super Admin does. Combined filters AND. One viewed row per load; no updates.

### Tests for User Story 4 ⚠️ fail first

- [x] T019 [P] [US4] Extend failing filter / 90-day clip / combined-AND / viewed-row tests in `tests/app/audit-read.test.ts` and `tests/rls/audit-read.test.ts` per [contracts/audit-http.md](./contracts/audit-http.md)
- [x] T020 [P] [US4] Confirm `/admin/audit-log` unauthorized cases remain in `tests/app/unauthorized-routes.test.ts` (Moderator, members, Admin without MFA)

### Implementation for User Story 4

- [x] T021 [US4] Extend `listAuditLog` in `lib/audit/read.ts` with Zod-validated `actor` / `action` / `from` / `to` / `severity` AND the existing Admin 90-day window; return the viewer column set (no `metadata`)
- [x] T022 [US4] Build presentational filter form (no role logic) in `components/audit-log-filters.tsx` and wire query params on `app/(admin)/admin/audit-log/page.tsx`; table may container-scroll at 360px

**Checkpoint**: Spec US4 independent test passes. SC-006 / SC-008 (viewed).

---

## Phase 7: User Story 5 - Export the filtered audit trail (Super Admin only) (Priority: P3)

**Goal**: `POST /admin/audit-log/export` (CSRF) returns UTF-8 CSV of the current filters for Super Admin only. Same-transaction `audit_log_exported` with `rowCount` + boolean filter flags (no PII keys). Admin has no control and a direct POST is denied with no file and no export row.

**Independent Test**: Super Admin filters then exports; CSV matches; one export row. Admin: no button; POST denied; 0 `audit_log_exported`.

### Tests for User Story 5 ⚠️ fail first

- [x] T023 [P] [US5] Write failing Super Admin CSV / empty-headers-only / export-audit-row / no-PII-columns tests in `tests/integration/audit-log-export.test.ts`
- [x] T024 [P] [US5] Write failing Admin/Moderator/member export deny (no file, no `audit_log_exported`) in `tests/app/unauthorized-routes.test.ts`

### Implementation for User Story 5

- [x] T025 [US5] Implement CSV export helper (same filters as `listAuditLog`, no cursor, RFC 4180, omit `metadata` and decrypted PII, `writeAudit` `audit_log_exported` same transaction) in `lib/audit/export.ts`
- [x] T026 [US5] Add `POST` handler in `app/(admin)/admin/audit-log/export/route.ts` with `requireRole({ admin: ['super_admin'], mfa: true })` and CSRF per [contracts/audit-http.md](./contracts/audit-http.md)
- [x] T027 [US5] Add export control on `app/(admin)/admin/audit-log/page.tsx` only when the server passes `canExport` (boolean prop; no `if (role === …)` in `components/`)

**Checkpoint**: Spec US5 independent test passes. SC-007 / SC-008 (exported).

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T028 [P] Axe fixtures for `/admin`, `/admin/analytics`, `/admin/audit-log` in `tests/a11y/admin-analytics-pages.test.ts` (44px targets; tables container-scroll at 360px)
- [x] T029 [P] Assert dashboard load does not call `track()` and export metadata keys stay off the PII denylist in `tests/unit/admin-analytics-privacy.test.ts`
- [x] T030 Run [quickstart.md](./quickstart.md) locally (`pnpm test`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`)

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: Ignore-file verify
- **Foundational (Phase 2)**: Blocks all stories. T004 (function) is required before T002/T003 can pass.
- **US1 → US2 → US3** share `app/(admin)/admin/analytics/page.tsx` and `lib/admin-analytics/load.ts` — sequential in this repo.
- **US4 → US5** share `lib/audit/read.ts` / audit page — sequential; US5 depends on US4 filters.
- **Polish**: after desired stories
- **MVP**: Phase 1–3 (KPI cards)

### User story independent tests

| Story | Independent test |
| --- | --- |
| US1 | KPI cards match fixture; Moderator/Pathways get 0 numbers |
| US2 | Funnel stages match invite/self-reg fixture; network filter isolates Pathways vs LEAD |
| US3 | Count 1–2 omitted entirely; ≥3 shown; each list ≤ 10; no forum |
| US4 | Admin 90-day clip; combined filters AND; one `audit_log_viewed` per load |
| US5 | Super Admin CSV + one `audit_log_exported`; Admin export 0 success |

### Parallel opportunities

- T002, T003 after T004 exists (write fail-first before T004)
- T006, T007, T008 together
- T019, T020 together
- T023, T024 together
- T028, T029 in polish

### Parallel example: User Story 1 tests

```text
Task: "Write failing KPI tests in tests/integration/admin-analytics-kpis.test.ts"
Task: "Write failing unauthorized /admin/analytics cases in tests/app/unauthorized-routes.test.ts"
Task: "Mark view_analytics built in tests/helpers/prd-matrix.ts and matrix test files"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational (T002 standalone EXECUTE file required; k=3 in SQL)
3. Phase 3 US1 KPI cards
4. **STOP and VALIDATE** US1 independent test

### Incremental Delivery

US2 funnel → US3 leaderboards → US4 audit filters → US5 CSV export → polish / quickstart.

### Notes

- [P] = different files, no incomplete-task dependency
- Do not mock `requireRole` in role tests
- Do not add npm packages
- Do not ALTER `audit_log` RLS or add a `p_min_count` argument
- Do not `track()` dashboard opens
- Do not show below-k leaderboard rows with a hidden number
- k=3 remains a named assumption until Amend confirms
