# Tasks: Announcement Banners

**Input**: Design documents from `/specs/005-announcements/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and spec FR-022/FR-023 require test-first permission proof. Write the listed tests first and confirm they **fail** before implementation. Do not mock `requireRole` in tests whose purpose is to verify it.

**Organization**: Setup → Foundational (blocks all stories) → user stories in spec order (US1–US5) → polish.

**Shared RLS core**: T003 (failing tests) + T005 (migration installs `announcement_visible_core(uuid)` from [contracts/rls-policies.md](./contracts/rls-policies.md)). SELECT / dismiss INSERT / click-impress INSERT **call that function**. Do not paste window + withdrawn + `visibility && app_role_tokens()` a second time in policy SQL.

**CTA uniqueness**: unique-per-user-per-announcement, not per-button ([assumptions-log.md](../../docs/decisions/assumptions-log.md); spec SC-009; PRD §2 CTR).

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

**Purpose**: Announcement tables, **one** `announcement_visible_core` function, RLS policies that reference it, seed fixtures. **No user story work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US5

### Tests (fail first)

- [x] T002 [P] Write failing RLS tests in `tests/rls/announcements-policies.test.ts` for SELECT visibility/window/withdraw/dismissal, INSERT/UPDATE admin-only, dismiss INSERT (dismissible + core, no NOT EXISTS so first dismiss works), impression/click INSERT (SELECT-equivalent including NOT EXISTS). `requireRole` is not in this file. Cite [contracts/rls-policies.md](./contracts/rls-policies.md).
- [x] T003 [P] Write failing unit tests in `tests/unit/announcement-visible-core.test.ts` that `announcement_visible_core(uuid)` is a single SQL function (query `pg_proc`) and that announcements SELECT / dismissals INSERT / impressions INSERT policy definitions in `pg_policies` contain `announcement_visible_core` and do **not** duplicate `deleted_at IS NULL` + `activates_at` + `app_role_tokens()` inline.

### Implementation

- [x] T004 Define `Announcement`, `AnnouncementDismissal`, `AnnouncementImpression`, `AnnouncementCtaClick` in `prisma/schema.prisma` per [data-model.md](./data-model.md) (visibility GIN, no user FK, click PK `(userId, announcementId)` + `slot`)
- [x] T005 Add migration in `prisma/migrations/` that creates the four tables, checks, GIN, ENABLE/FORCE RLS, grants, **and** function `announcement_visible_core(uuid)` copied from [contracts/rls-policies.md](./contracts/rls-policies.md). CREATE POLICY statements MUST reference `announcement_visible_core(...)` — do not duplicate the core predicates. Same migration as the policies; not a later follow-up. SELECT adds `NOT EXISTS` dismissal on top of the function. Dismiss INSERT adds `dismissible` on top of the function (no `NOT EXISTS`). Click/impress INSERT uses the same SELECT-equivalent (`announcement_visible_core` + `NOT EXISTS` dismissal).
- [x] T006 Seed live shared / Pathways / LEAD / both-program banners plus scheduled, expired, withdrawn, and three staggered-`activates_at` Pathways-visible rows in `prisma/seed.ts`

**Checkpoint**: `pnpm db:migrate` and `pnpm db:seed` succeed. T002/T003 pass. Existing `002`/`003`/`004` tests still pass. User stories may start.

---

## Phase 3: User Story 1 - Admin publishes a time-windowed banner (Priority: P1) 🎯 MVP

**Goal**: MFA-satisfied Admin/Super Admin creates a banner with headline, allowlisted body, visibility, window, optional CTAs. Past `activates_at` goes live immediately. Moderator/members denied admin routes.

**Independent Test**: As Admin, create one shared and one Pathways-only in-window banner. Both appear on `/admin/announcements` as active. Pathways member sees both (subject to cap); LEAD sees only shared. Moderator cannot open `/admin/announcements/new`.

### Tests for User Story 1 ⚠️ fail first

- [x] T007 [P] [US1] Write failing create success/validation tests in `tests/integration/announcement-publish.test.ts`
- [x] T008 [P] [US1] Write failing unauthorized deny for `/admin/announcements*` (Moderator, Pathways, LEAD, Pending) in `tests/app/unauthorized-routes.test.ts`
- [x] T009 [P] [US1] Mark `create_manage_announcements` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`

### Implementation for User Story 1

- [x] T010 [US1] Implement markdown allowlist + CTA URL validation in `lib/announcements/validate.ts`
- [x] T011 [US1] Implement create (INSERT + `announcement_created` same transaction) in `lib/announcements/publish.ts`
- [x] T012 [US1] Build presentational form (no role logic) in `components/announcement-form.tsx`
- [x] T013 [US1] Build `/admin/announcements` and `/admin/announcements/new` with `requireRole({ admin: ["admin", "super_admin"], mfa: true })` in `app/(admin)/admin/announcements/page.tsx` and `app/(admin)/admin/announcements/new/page.tsx`

**Checkpoint**: Spec US1 independent test passes.

---

## Phase 4: User Story 2 - Members see at most two eligible banners (Priority: P1)

**Goal**: Member layout chrome shows in-window, visibility-intersecting, not-withdrawn, not-dismissed banners, capped at the most recently activated two (`activates_at DESC, id DESC`). Pending: none. Skip `/app/pending`.

**Independent Test**: Three in-window Pathways-visible banners with staggered `activates_at`; Pathways sees only the most recently activated two; LEAD sees none of a Pathways-only set; pending sees none.

### Tests for User Story 2 ⚠️ fail first

- [x] T014 [P] [US2] Write failing list/cap/window/visibility tests in `tests/integration/announcement-visibility.test.ts`
- [x] T015 [P] [US2] Mark `view_announcements` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`

### Implementation for User Story 2

- [x] T016 [US2] Implement `listEligibleBanners` (`ORDER BY activates_at DESC, id DESC LIMIT 2`) inside `withRls` in `lib/announcements/list.ts`
- [x] T017 [US2] Build presentational banner chrome (no role branches) in `components/announcement-banners.tsx`
- [x] T018 [US2] Load banners in `app/(member)/layout.tsx` except `/app/pending`; `requireRole` before data

**Checkpoint**: Spec US2 independent test passes. FR-012/FR-013.

---

## Phase 5: User Story 3 - Per-user dismissal (Priority: P1)

**Goal**: Dismissible banners can be dismissed per user; they do not return for that user; other users still see them; dismissing can free a cap slot.

**Independent Test**: Pathways dismisses one of two shown; reload omits it and may show a third; another Pathways user still sees the original.

### Tests for User Story 3 ⚠️ fail first

- [x] T019 [P] [US3] Write failing dismiss/idempotent/non-dismissible/withhold tests in `tests/integration/announcement-dismiss.test.ts`

### Implementation for User Story 3

- [x] T020 [US3] Implement dismiss (`ON CONFLICT DO NOTHING`) in `lib/announcements/dismiss.ts`
- [x] T021 [US3] Add POST `/app/announcements/[id]/dismiss` (CSRF) in `app/(member)/app/announcements/[id]/dismiss/route.ts`
- [x] T022 [US3] Wire dismiss control on `components/announcement-banners.tsx` (leaf `use client` only if needed)

**Checkpoint**: Spec US3 independent test passes.

---

## Phase 6: User Story 4 - Admin queue, edit, withdraw (Priority: P2)

**Goal**: `/admin/announcements` filters scheduled/active/expired/withdrawn. Edit applies immediately. Withdraw hides from members and writes `announcement_deleted`.

**Independent Test**: Create future, live, expired; filter each; edit scheduled visibility; withdraw live; members no longer see it.

### Tests for User Story 4 ⚠️ fail first

- [x] T023 [P] [US4] Write failing queue/edit/withdraw tests in `tests/integration/announcement-admin.test.ts`

### Implementation for User Story 4

- [x] T024 [US4] Implement `updateAnnouncement` and `withdrawAnnouncement` in `lib/announcements/edit.ts`
- [x] T025 [US4] Build `/admin/announcements/[id]` edit + withdraw in `app/(admin)/admin/announcements/[id]/page.tsx`
- [x] T026 [US4] Add Announcements link on `app/(admin)/admin/page.tsx`

**Checkpoint**: Spec US4 independent test passes.

---

## Phase 7: User Story 5 - Unique impression and CTA click (Priority: P2)

**Goal**: First show of a capped banner inserts impression + `track`. First CTA click inserts one row (`slot` = first button), `track`, 302. Second click (same or other slot): no second row/event, still 302 if eligible. No PII/copy in payloads.

**Independent Test**: Two page loads → one impression row. Primary then secondary click → one click row, `slot=primary`; both 302.

### Tests for User Story 5 ⚠️ fail first

- [x] T027 [P] [US5] Write failing unique impression/click/PII tests in `tests/integration/announcement-analytics.test.ts` and extend `tests/unit/analytics.test.ts`

### Implementation for User Story 5

- [x] T028 [US5] Extend `lib/analytics/track.ts` with `announcement_impression` / `announcement_cta_click` and allowlisted `announcementId` / `ctaSlot`
- [x] T029 [US5] Record unique impressions inside `lib/announcements/list.ts` (`ON CONFLICT DO NOTHING` then `track` only on insert)
- [x] T030 [US5] Implement CTA POST + 302 in `lib/announcements/cta.ts` and `app/(member)/app/announcements/[id]/cta/[slot]/route.ts`

**Checkpoint**: Spec US5 independent test passes. Assumptions-log unique-per-announcement, not per-button.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T031 [P] Axe fixtures for member chrome and `/admin/announcements*` in `tests/a11y/announcement-pages.test.ts`
- [x] T032 Run [quickstart.md](./quickstart.md) locally (`pnpm test`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`)

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: Ignore-file verify
- **Foundational (Phase 2)**: Blocks all stories. T005 (shared SQL function) is required before T002/T003 can pass.
- **US1 → US2 → US3 → US4 → US5 → Polish**: sequential in this repo (same files). Tests fail first within each story.
- **MVP**: Phase 1–3 (admin publish). Cap/dismissal/analytics follow.

### Parallel opportunities

T002/T003 after T005 exists they will fail until T005; write tests first then T004–T006. T007/T008/T009 [P]. T014/T015 [P]. T031 [P] after pages exist.

---

## Implementation Strategy

1. Setup + Foundational (`announcement_visible_core` in the same migration as policies)
2. US1 MVP (create + admin new)
3. US2 chrome + cap of two
4. US3 dismiss
5. US4 queue/edit/withdraw
6. US5 unique analytics
7. a11y + quickstart
