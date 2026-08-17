# Tasks: Gated Resource Library

**Input**: Design documents from `/specs/004-resource-library/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and spec FR-023/FR-024 require test-first permission proof. Write the listed tests first and confirm they **fail** before implementation. Do not mock `requireRole` in tests whose purpose is to verify it.

**Organization**: Setup → Foundational (blocks all stories) → user stories in spec order (US1–US8) → polish.

**RLS-RES-UPD-DL**: T005 (failing tests) + T008 (migration installs the `BEFORE UPDATE` trigger from [contracts/rls-policies.md](./contracts/rls-policies.md)). Do not leave `download_count = OLD + 1` as application-only.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US8) on story-phase tasks only
- Every task has a concrete file path

## Path Conventions

Repository-root Next.js app per plan.md (`app/`, `lib/`, `prisma/`, `tests/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, env, and local MinIO/ClamAV compose. App scaffold already exists from `002-auth-rbac` / `003-registration-invitation-approval`.

- [x] T001 Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` in `package.json` and install so `pnpm-lock.yaml` updates
- [x] T002 [P] Add `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `CLAMD_HOST` / `CLAMD_PORT` / `POSTHOG_KEY` (env names only) in `.env.example` and validate in `lib/env.ts`
- [x] T003 [P] Add MinIO service and bucket bootstrap in `docker-compose.yml`
- [x] T004 [P] Add `clamav` service under compose profile `scan` in `docker-compose.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `resources` table, native RLS, **RLS-RES-UPD-DL** trigger, `resource_download` GUC, storage wrapper, scan double, seed fixtures. **No user story work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US8

### Tests (fail first)

- [x] T005 [P] Write failing RLS tests in `tests/rls/resources-policies.test.ts` for SELECT visibility/soft-delete, INSERT/UPDATE admin-only, and **RLS-RES-UPD-DL**: under `authMode: "resource_download"`, `download_count = old + 1` succeeds; `old+2` / `old+0` / `old-1` fail; any other-column change (`title`, `preview_text`, `tags`, `file_mime_type`, `file_object_key`, `deleted_at`, `updated_at`, …) fails; Pathways cannot bump a LEAD-only row. Cite [contracts/rls-policies.md](./contracts/rls-policies.md). `requireRole` is not in this file.
- [x] T006 [P] Write failing EICAR-infected vs clean tests for the scan port in `tests/unit/scan.test.ts`

### Implementation

- [x] T007 Define `Resource` in `prisma/schema.prisma` per [data-model.md](./data-model.md) (visibility GIN, `download_count`, `deleted_at`, no user FK)
- [x] T008 Add migration in `prisma/migrations/` that creates `resources`, checks, GIN, ENABLE/FORCE RLS, grants, the `resources_update` policy, **and** function/trigger `resources_resource_download_guard` **RLS-RES-UPD-DL** copied in intent from [contracts/rls-policies.md](./contracts/rls-policies.md) (same migration as the UPDATE policy; not a later follow-up)
- [x] T009 Extend `authMode` with `resource_download` in `lib/db/rls.ts`
- [x] T010 [P] Implement S3 wrapper (presign PUT/GET, delete, copy/promote, `forcePathStyle`) in `lib/storage/client.ts` — no SDK imports outside this directory
- [x] T011 [P] Implement scan port in `lib/scan/clamav.ts`: EICAR test double by default; `CLAMD_HOST` uses clamd INSTREAM
- [x] T012 Seed live shared / Pathways / LEAD / both-program fixtures plus one withdrawn row into MinIO + `resources` in `prisma/seed.ts`

**Checkpoint**: `pnpm db:migrate` and `pnpm db:seed` succeed. T005/T006 pass. Existing `002`/`003` tests still pass. User stories may start.

---

## Phase 3: User Story 1 - Admin publishes a resource (Priority: P1) 🎯 MVP

**Goal**: MFA-satisfied Admin/Super Admin request ingest slots, PUT files to storage, submit metadata; on clean scan both objects promote and one downloadable row exists with `resource_created`. Moderator/members denied admin routes.

**Independent Test**: As Admin, publish one shared and one Pathways-only resource. Both appear on `/admin/resources`. Pathways member sees both; LEAD member sees only shared. Moderator cannot open `/admin/resources/new`.

### Tests for User Story 1 ⚠️ fail first

- [x] T013 [P] [US1] Write failing publish success/validation tests in `tests/integration/resource-publish.test.ts`
- [x] T014 [P] [US1] Write failing unauthorized deny for `/admin/resources*` (Moderator, Pathways, LEAD, Pending) in `tests/app/unauthorized-routes.test.ts`
- [x] T015 [P] [US1] Mark `upload_edit_delete_resources` built (A for Admin/Super Admin) in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`

### Implementation for User Story 1

- [x] T016 [US1] Implement ingest-slot minting and clean-scan commit (presigned PUT keys under `ingest/`, scan file+thumb, promote, INSERT, `resource_created`) in `lib/resources/publish.ts`
- [x] T017 [US1] Build presentational publish form (no role logic) in `components/resource-form.tsx`
- [x] T018 [US1] Build `/admin/resources` and `/admin/resources/new` with `requireRole({ admin: ["admin", "super_admin"], mfa: true })` in `app/(admin)/admin/resources/page.tsx` and `app/(admin)/admin/resources/new/page.tsx`
- [x] T019 [US1] Wire ingest-slot + publish server actions (CSRF) from `app/(admin)/admin/resources/new/page.tsx` to `lib/resources/publish.ts`

**Checkpoint**: Spec US1 independent test passes. MVP demoable (admin publish + seeded visibility).

---

## Phase 4: User Story 2 - Members browse only what their roles allow (Priority: P1)

**Goal**: `/app/resources` and `/app/resources/[id]` show live rows whose visibility intersects the signed session. Pending → holding. Guessed ids withhold without naming the other cohort. RLS still holds if layer 2 is skipped.

**Independent Test**: Seeded visibilities; list/detail by role including guessed ids; same reads via `pnpm test:rls`. Moderator sees all live visibilities, still cannot publish.

### Tests for User Story 2 ⚠️ fail first

- [x] T020 [P] [US2] Write failing list/detail/pending/guessed-id tests in `tests/integration/resource-visibility.test.ts`
- [x] T021 [P] [US2] Mark `view_shared_resources` and `view_role_specific_resources` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`

### Implementation for User Story 2

- [x] T022 [US2] Implement list/get with `visibilityTokens` + `deleted_at: null` inside `withRls` in `lib/resources/list.ts`
- [x] T023 [US2] Build presentational cards/list (no role branches) in `components/resource-card.tsx` and `components/resource-list.tsx`
- [x] T024 [US2] Build `/app/resources` and `/app/resources/[id]` (last-updated; not-found withholding) in `app/(member)/app/resources/page.tsx` and `app/(member)/app/resources/[id]/page.tsx`
- [x] T025 [US2] Implement thumbnail grant redirect (120s signed GET, no download audit) in `app/(member)/app/resources/[id]/thumbnail/route.ts`

**Checkpoint**: Spec US2 independent test passes. FR-006–FR-010 for reads.

---

## Phase 5: User Story 3 - Role-checked download with audit (Priority: P1)

**Goal**: Download only after `requireRole` + RLS load of a live visible row. Same transaction: `authMode: "resource_download"` (this must be the **only** production call site), `download_count + 1` (trigger **RLS-RES-UPD-DL**), `resource_downloaded`, then 302 to 900s signed GET. No durable bucket URL.

**Independent Test**: Pathways downloads shared + Pathways-only (audit row each). LEAD-only id, withdrawn id, pending session: no file. Page source has no durable storage URL.

### Tests for User Story 3 ⚠️ fail first

- [x] T026 [P] [US3] Write failing download allow/deny/audit/`download_count` tests in `tests/integration/resource-download.test.ts`
- [x] T027 [P] [US3] Mark `download_resources` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`

### Implementation for User Story 3

- [x] T028 [US3] Implement download grant in `lib/resources/download.ts`: **only** this module sets `authMode: "resource_download"`; bump count, write `resource_downloaded`, then presign GET. Do not set this mode from list, publish, edit, or analytics.
- [x] T029 [US3] Add GET `/app/resources/[id]/download` redirect in `app/(member)/app/resources/[id]/download/route.ts` calling `lib/resources/download.ts`
- [x] T030 [US3] Add GET `/app/resources/[id]/file` (signed GET, **no** count bump / **no** `resource_download` mode) in `app/(member)/app/resources/[id]/file/route.ts` for video src in US8; US3 may leave it as a role-checked file grant

**Checkpoint**: Spec US3 independent test passes. T005 still passes (trigger, not app-only +1).

---

## Phase 6: User Story 4 - Scan before downloadable (Priority: P1)

**Goal**: File **or** thumbnail fail/unscannable fails the whole publish/replace. Rejected objects deleted from storage; no row (or no new keys); no product path can sign those keys (FR-026).

**Independent Test**: Infected main file; separately clean file + infected thumb. Both requests fail; MinIO has no leftover ingest/live keys; members see nothing new. Failed replace still serves the previous live file.

### Tests for User Story 4 ⚠️ fail first

- [x] T031 [P] [US4] Write failing EICAR-file, EICAR-thumb, and failed-replace tests (objects gone, 0 rows / keys unchanged) in `tests/integration/resource-scan-fail.test.ts`

### Implementation for User Story 4

- [x] T032 [US4] Complete fail-closed ingest in `lib/resources/publish.ts`: scan both; on any failure `DeleteObject` ingest keys; no INSERT; replace deletes only new ingest; admin-facing generic error (no scanner internals)

**Checkpoint**: Spec US4 independent test passes. FR-013, FR-014, FR-026.

---

## Phase 7: User Story 5 - Search, filter, and sort (Priority: P2)

**Goal**: Keyword on title+preview (escaped ILIKE), tag chips, source filter, sort newest / most downloaded / alphabetical. Never leak hidden, withdrawn, or failed-ingest rows.

**Independent Test**: Distinct titles/tags/sources/counts; Pathways search/filter/sort never includes LEAD-only.

### Tests for User Story 5 ⚠️ fail first

- [x] T033 [P] [US5] Write failing search/filter/sort and ILIKE-escape tests in `tests/integration/resource-search.test.ts` and `tests/unit/search-escape.test.ts`

### Implementation for User Story 5

- [x] T034 [US5] Implement search/filter/sort in `lib/resources/list.ts` per [research.md](./research.md) §6
- [x] T035 [US5] Add labeled search, tag chips, source filter, sort controls in `components/resource-filters.tsx` and `app/(member)/app/resources/page.tsx`

**Checkpoint**: Spec US5 independent test passes. FR-015.

---

## Phase 8: User Story 6 - Edit metadata or replace file (Priority: P2)

**Goal**: Same resource id. Metadata edit and clean replace update `updated_at` and emit `resource_edited`. Replace re-runs scan in the same request. Visibility tighten withholds from the other cohort.

**Independent Test**: Edit title; replace with clean file; id stable; members get new file; Moderator cannot edit.

### Tests for User Story 6 ⚠️ fail first

- [x] T036 [P] [US6] Write failing edit/replace/visibility-tighten tests in `tests/integration/resource-edit.test.ts`

### Implementation for User Story 6

- [x] T037 [US6] Implement metadata update and file/thumb replace (scan, promote, delete old live keys on success only) in `lib/resources/edit.ts`
- [x] T038 [US6] Build `/admin/resources/[id]` edit UI in `app/(admin)/admin/resources/[id]/page.tsx` using `components/resource-form.tsx`

**Checkpoint**: Spec US6 independent test passes. FR-016.

---

## Phase 9: User Story 7 - Soft-delete (Priority: P2)

**Goal**: Set `deleted_at`; hide from all member paths; retain storage objects; `resource_deleted`; admin list still shows withdrawn. Member guessed id = same withholding as out-of-visibility.

**Independent Test**: Soft-delete a visible resource; members cannot list/open/download; admin sees withdrawn; Moderator cannot delete.

### Tests for User Story 7 ⚠️ fail first

- [x] T039 [P] [US7] Write failing withdraw/withholding/retain-object tests in `tests/integration/resource-soft-delete.test.ts`

### Implementation for User Story 7

- [x] T040 [US7] Implement soft-delete (`deleted_at`, objects kept, `resource_deleted`) in `lib/resources/edit.ts`
- [x] T041 [US7] Add withdraw control on `app/(admin)/admin/resources/[id]/page.tsx` and withdrawn state on `app/(admin)/admin/resources/page.tsx`

**Checkpoint**: Spec US7 independent test passes. FR-017.

---

## Phase 10: User Story 8 - Play video in place (Priority: P3)

**Goal**: MP4 detail page uses in-page player with role-checked `/file` src (range hits storage). No forced download. Non-video stays download. No `resource_downloaded` on play.

**Independent Test**: Pathways plays a Pathways-visible MP4; LEAD withheld; no durable storage URL.

### Tests for User Story 8 ⚠️ fail first

- [x] T042 [P] [US8] Write failing in-page play vs withhold vs non-video tests in `tests/integration/resource-video.test.ts`

### Implementation for User Story 8

- [x] T043 [US8] Add presentational player in `components/resource-video.tsx` and render it from `app/(member)/app/resources/[id]/page.tsx` when `file_mime_type` is `video/mp4` using `app/(member)/app/resources/[id]/file/route.ts`

**Checkpoint**: Spec US8 independent test passes. FR-019.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Nav, analytics opacity, a11y, quickstart.

- [x] T044 [P] Add axe coverage for `/app/resources`, `/app/resources/[id]`, `/admin/resources*` in `tests/a11y/`
- [x] T045 [P] Add Resources to member nav in `app/(member)/layout.tsx` (and existing nav component if that is where links live)
- [x] T046 [P] Link Resources from `app/(admin)/admin/page.tsx`
- [x] T047 [P] Add no-op-unless-keyed tracker in `lib/analytics/track.ts` and emit opaque `resource_viewed` / `resource_downloaded` (ids + role labels only) from `lib/resources/list.ts` and `lib/resources/download.ts`
- [x] T048 Run [quickstart.md](./quickstart.md) locally (`pnpm test`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** US1–US8
- **US1–US8**: Depend on Foundational; sequential in priority is safest (publish before browse before download before scan-fail paths that assume publish exists)
- **Polish**: After desired stories

### User Story Dependencies

- **US1**: After Phase 2 — first product publish path
- **US2**: After Phase 2; uses seed and/or US1 rows
- **US3**: After US2 detail page exists (download from a visible row). T028 is the sole `resource_download` setter
- **US4**: After US1 publish helper exists (fail path in same `lib/resources/publish.ts`)
- **US5**: After US2 list
- **US6 / US7**: After US1 admin pages
- **US8**: After US3 `/file` route

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Helpers before pages
- Story complete before the next priority unless staffed in parallel after Phase 2

### Parallel Opportunities

- T002–T004 after T001’s package add can overlap with T002/T003/T004
- T005 ∥ T006; T010 ∥ T011 after T007–T009
- T013–T015 together; T020–T021; T026–T027
- T044–T047 in polish

---

## Parallel Example: Foundational tests + wrappers

```text
T005 tests/rls/resources-policies.test.ts   # includes RLS-RES-UPD-DL
T006 tests/unit/scan.test.ts
T010 lib/storage/client.ts
T011 lib/scan/clamav.ts
```

## Parallel Example: US1 tests

```text
T013 tests/integration/resource-publish.test.ts
T014 tests/app/unauthorized-routes.test.ts
T015 tests/helpers/prd-matrix.ts + matrix tests
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup
2. Phase 2 Foundational (including **RLS-RES-UPD-DL** T005 + T008)
3. Phase 3 US1
4. **STOP and VALIDATE** spec US1 independent test

### Recommended content increment

US1 + US2 + US3 so a member can see and download a gated file with an audit row. Then US4 (scan fail), US5–US7, US8.

### Incremental Delivery

1. Setup + Foundational
2. US1 → admin publish
3. US2 → role-gated library
4. US3 → signed download + audit
5. US4 → scan fail / FR-026
6. US5 → search
7. US6 → edit/replace
8. US7 → soft-delete
9. US8 → video
10. Polish / quickstart

---

## Notes

- Cite PRD §5.5 / §3 / §4 / §6 / §8 and Constitution I, II, III, IV in the change that implements each FR
- `lib/storage/`, `lib/scan/`, `lib/resources/` are new (research §9)
- **RLS-RES-UPD-DL** lives in T005 + T008; T028 is the only `authMode: "resource_download"` call site
- Q3 remains Pathways and LEAD only
- Do not add a job queue, quarantine prefix, semantic search, restore UI, or DreamHost provisioning
- Commit after each task or logical group if the operator asks for commits
