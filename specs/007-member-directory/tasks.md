# Tasks: Member Directory

**Input**: Design documents from `/specs/007-member-directory/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and spec FR-022/FR-023 require test-first permission proof. Write the listed tests first and confirm they **fail** before implementation. Do not mock `requireRole` in tests whose purpose is to verify it.

**Organization**: Setup → Foundational (blocks all stories) → user stories in spec order (US1–US5) → polish.

**Do not widen `users` SELECT.** Directory reads use projection tables. `directory_listing_visible(uuid)` is the one visibility function ([contracts/rls-policies.md](./contracts/rls-policies.md)). Shown-field SELECT **calls** it. Hidden title/DOC/email ciphertext MUST NOT live on a peer-visible row.

**Leaving `active`**: T006 installs the status trigger from [research.md](./research.md) §11. Deactivation is **not** read-gate-only: listing + shown-field rows are **deleted**; `directory_visible` is set false.

**Standalone EXECUTE**: T003 is its own task and file. Do **not** fold it into T002. Helper-path search/privacy tests do not satisfy T003.

**Q2 / Q12**: Proceed on `docs/decisions/assumptions-log.md` (unconfirmed by Amend). Controlled DOC list labels; opt-in default off.

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

**Purpose**: User directory flags, projection tables, `directory_listing_visible`, status-leave-active trigger, RLS, seed fixtures. **No user story work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US5

### Tests (fail first)

- [x] T002 [P] Write failing RLS tests in `tests/rls/directory-policies.test.ts` for own-row INSERT/UPDATE/DELETE on `directory_listings` and shown-field tables, own-row throttle, SELECT policies that **call** `directory_listing_visible`, pending viewer sees 0 listings, and `users` policy text in `pg_policies` still has no same-program peer SELECT. `requireRole` is not in this file. Cite [contracts/rls-policies.md](./contracts/rls-policies.md). **Do not put Direct EXECUTE `directory_listing_visible` cases in this file.**
- [x] T003 [P] Write failing tests in `tests/rls/directory-listing-visible.test.ts` that (1) `SELECT directory_listing_visible($id)` as `amend_app` (raw SQL `EXECUTE`, **not** `lib/directory`), with caller GUCs for a Pathways member who is not staff, on a same-program listing **and** a LEAD listing **and** a deactivated listing; (2) `SELECT` from `users` as that Pathways member returns **0** other-user rows (policy not widened); (3) after a peer hides title, `SELECT` from `directory_shown_titles` as Pathways returns 0 rows for that peer; (4) after owner `UPDATE users.status` to `deactivated` on a listed member who had a shown-email row, `SELECT directory_shown_emails` for that id returns **0 rows** (deleted, not merely unread). Assert the cases in [contracts/rls-policies.md](./contracts/rls-policies.md) § Direct EXECUTE `directory_listing_visible`. This task MUST stay standalone.
- [x] T004 [P] Write failing unit tests in `tests/unit/directory-listing-visible.test.ts` that `directory_listing_visible(uuid)` is a single SQL function (query `pg_proc`), that listings / shown-field SELECT policy definitions in `pg_policies` contain `directory_listing_visible` and do **not** paste staff-OR-same-program predicates inline, and that an `AFTER UPDATE OF status` trigger on `users` exists whose function deletes listing + shown-field rows (research §11).

### Implementation

- [x] T005 Define User delta (`directoryVisible`, `directoryShowTitle`, `directoryShowDocAffiliation`, `directoryShowEmail`, `directoryPrivacySetAt`) and models `DirectoryListing`, `DirectoryShownTitle`, `DirectoryShownDoc`, `DirectoryShownEmail`, `DirectorySearchThrottle` in `prisma/schema.prisma` per [data-model.md](./data-model.md) (no user FKs; ciphertext copies; listing PK `userId`)
- [x] T006 Add migration in `prisma/migrations/` that creates the tables, ENABLE/FORCE RLS, grants, function `directory_listing_visible(uuid)` copied from [contracts/rls-policies.md](./contracts/rls-policies.md), CREATE POLICY statements that **call** that function, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO amend_app`, and `AFTER UPDATE OF status ON users` trigger per [research.md](./research.md) §11 (leave `active` → DELETE listing + shown-field rows, `directory_visible = false`; do not clear the three show flags). Same migration as the policies; not a later follow-up. Do **not** alter `users_select`.
- [x] T007 Add directory fixture cleanup in `tests/helpers/directory-cleanup.ts` (delete listings / shown rows / throttle / extra users by email prefix, same pattern as event cleanup)
- [x] T008 Seed opted-in / opted-out Pathways and LEAD members with mixed field toggles (title on / DOC off / email off, and the reverse) in `prisma/seed.ts`. Existing eight auth users stay **not** listed by default (Q12). Password = `SEED_PASSWORD`.

**Checkpoint**: `pnpm db:migrate` and `pnpm db:seed` succeed. T002/T003/T004 pass. Existing `002`–`006` tests still pass. User stories may start.

---

## Phase 3: User Story 1 - Opt in and set field-level privacy (Priority: P1) 🎯 MVP

**Goal**: Active Pathways/LEAD members turn listing on/off and set uniform show/hide for title, DOC affiliation, and email. Default listing off; three fields default hidden. Privacy save syncs projection tables and writes `directory_privacy_changed`. Staff-only accounts (`program_role = none`) cannot appear.

**Independent Test**: Two Active Pathways members. Leave A opted out; opt B in with title on and DOC/email off. A does not appear for another Pathways member; B appears with name, network, and title, without DOC or email. Pending cannot list themselves.

### Tests for User Story 1 ⚠️ fail first

- [x] T009 [P] [US1] Write failing opt-in / field-toggle / opt-out / audit (no PII in metadata) tests in `tests/integration/directory-privacy.test.ts`
- [x] T010 [P] [US1] Write failing unauthorized deny for `/app/profile/privacy` (pending, invited, signed-out) in `tests/app/unauthorized-routes.test.ts`
- [x] T011 [P] [US1] Mark `appear_in_directory` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts` per [contracts/permission-matrix.md](./contracts/permission-matrix.md) (Pathways/LEAD allow; Super Admin/Admin/Moderator deny; pending/invited deny)

### Implementation for User Story 1

- [x] T012 [US1] Implement privacy save (own-row flags, upsert/delete `directory_listings` + shown-field children from current ciphertext, staff-only cannot insert a listing, `directory_privacy_changed` same transaction) in `lib/directory/privacy.ts`
- [x] T013 [US1] Build presentational privacy form (no role logic; plain-language who-can-see copy including uniform hide) in `components/directory-privacy-form.tsx`
- [x] T014 [US1] Build GET/POST `/app/profile/privacy` with `requireRole` (active session, CSRF on POST) in `app/(member)/app/profile/privacy/page.tsx`
- [x] T015 [US1] Build first-run prompt leaf (no role logic) in `components/directory-privacy-prompt.tsx` and show it on `app/(member)/app/page.tsx` when `directory_privacy_set_at` is null
- [x] T016 [US1] Add Privacy link on `app/(member)/layout.tsx`

**Checkpoint**: Spec US1 independent test passes.

---

## Phase 4: User Story 2 - Search the same-program directory (Priority: P1)

**Goal**: `/app/directory` lists opted-in members the viewer may see. Search by name, shown title, shown DOC label, network. Hidden title/DOC are excluded from matching (not a blanked hit). Empty query lists the allowed set and counts as a search toward the cap (cap enforced in US5).

**Independent Test**: Seed opted-in Pathways and LEAD with mixed toggles. Pathways search returns only Pathways; LEAD only LEAD; title-hidden member is not found by title; DOC-hidden member is not found by affiliation; pending sees zero.

### Tests for User Story 2 ⚠️ fail first

- [x] T017 [P] [US2] Write failing same-program list/search / hidden-field oracle / pending-zero tests in `tests/integration/directory-search.test.ts`
- [x] T018 [P] [US2] Mark `view_directory` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts` per [contracts/permission-matrix.md](./contracts/permission-matrix.md)
- [x] T019 [P] [US2] Write failing unit tests in `tests/unit/directory-search-match.test.ts` that a query matching only a hidden title or hidden DOC label does not keep that member, and a visible name match does
- [x] T020 [P] [US2] Write failing unauthorized deny for `/app/directory` (pending, signed-out) in `tests/app/unauthorized-routes.test.ts`

### Implementation for User Story 2

- [x] T021 [US2] Implement decrypt-then-match list/search (RLS listings + shown children; never `SELECT` other `users` rows; staff see both programs at this layer too) in `lib/directory/list.ts`
- [x] T022 [US2] Extend `lib/analytics/track.ts` with `directory_search` (opaque ids + roles only; denylist query/name/email/title/DOC)
- [x] T023 [US2] Build search leaf (no role logic) in `components/directory-search-form.tsx` and page `app/(member)/app/directory/page.tsx`; show first-run prompt when privacy unset
- [x] T024 [US2] Add Directory link on `app/(member)/layout.tsx`

**Checkpoint**: Spec US2 independent test passes. Hidden-field oracle holds.

---

## Phase 5: User Story 3 - Open a directory profile (Priority: P1)

**Goal**: `/app/directory/[id]` shows name, network, initials, and only shown optional fields. Other-program / opted-out / deactivated withheld like other role-gated content. Other-member view writes `directory_profile_viewed` + analytics. Self-view uses the same field set as any viewer; no profile-view audit.

**Independent Test**: Opted-in Pathways with email on and DOC off. Pathways peer sees name, network, email, no DOC; LEAD is withheld; opening the allowed profile writes the audit event.

### Tests for User Story 3 ⚠️ fail first

- [x] T025 [P] [US3] Write failing profile field-hide / withhold / other-member audit / self-view no-audit tests in `tests/integration/directory-profile.test.ts`
- [x] T026 [P] [US3] Write failing unauthorized / withhold cases for `/app/directory/[id]` in `tests/app/unauthorized-routes.test.ts`

### Implementation for User Story 3

- [x] T027 [US3] Extend `lib/analytics/track.ts` with `directory_profile_viewed` and allowlisted `viewedUserId`
- [x] T028 [US3] Implement profile load (same visibility as list; audit + track only when viewer ≠ subject) in `lib/directory/profile.ts`
- [x] T029 [US3] Build initials treatment (tokens, no uploaded avatar) in `components/member-initials.tsx` and profile page `app/(member)/app/directory/[id]/page.tsx`

**Checkpoint**: Spec US3 independent test passes. SC-010 / SC-011 for profile view.

---

## Phase 6: User Story 4 - Staff see all opted-in members (Priority: P2)

**Goal**: Super Admin, Admin, and Moderator see opted-in Active members of **both** programs on `/app/directory`. Uniform field hide still applies. No staff override of listing or toggles. MFA is **not** required (member app).

**Independent Test**: Opt in one Pathways and one LEAD. Admin sees both; a Pathways member still sees only Pathways; Admin does not see a hidden DOC field.

### Tests for User Story 4 ⚠️ fail first

- [x] T030 [P] [US4] Write failing staff-both-programs + staff-uniform-hide tests in `tests/integration/directory-staff.test.ts`

### Implementation for User Story 4

- [x] T031 [US4] Confirm `lib/directory/list.ts` and `lib/directory/profile.ts` use RLS (staff OR same-program) with **no** extra layer-2 filter that drops the other program for staff; add privacy-page copy that staff see all listed members in `components/directory-privacy-form.tsx` if missing

**Checkpoint**: Spec US4 independent test passes.

---

## Phase 7: User Story 5 - Rate-limited search (Priority: P2)

**Goal**: 30 directory searches per user per tumbling 60-second window, including empty-query list loads. 31st: generic try-later, 0 result rows, no analytics, no existence leak.

**Independent Test**: One member: 30 searches then a 31st refused with no list. A second member can still search.

### Tests for User Story 5 ⚠️ fail first

- [x] T032 [P] [US5] Write failing 30-then-31st / second-user-unaffected tests in `tests/integration/directory-rate-limit.test.ts`

### Implementation for User Story 5

- [x] T033 [US5] Implement own-row tumbling window counter in `lib/directory/throttle.ts`
- [x] T034 [US5] Call throttle **before** list/search in `lib/directory/list.ts` (over cap → no rows, no `track('directory_search')`)

**Checkpoint**: Spec US5 independent test passes. SC-009.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T035 [P] Axe fixtures for `/app/directory`, `/app/directory/[id]`, `/app/profile/privacy`, and home prompt in `tests/a11y/directory-pages.test.ts`
- [x] T036 [P] Extend payload allow/deny cases in `tests/unit/analytics.test.ts` for `directory_search` / `directory_profile_viewed` (reject query strings, names, emails, titles, DOC)
- [x] T037 Run [quickstart.md](./quickstart.md) locally (`pnpm test`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`)

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: Ignore-file verify
- **Foundational (Phase 2)**: Blocks all stories. T006 (function + trigger + policies) is required before T002/T003/T004 can pass.
- **US1 → US2 → US3 → US4 → US5 → Polish**: sequential in this repo (shared `lib/directory/list.ts`). Tests fail first within each story.
- **MVP**: Phase 1–3 (privacy + projection tables). Search, profile, staff both-programs, and rate limit follow.

### User story independent tests

| Story | Independent test |
| --- | --- |
| US1 | Pathways A opted out stays hidden; B opted in with title on / DOC off appears that way; pending cannot list |
| US2 | Pathways sees 0 LEAD; hidden DOC search returns 0 hits for that member; name search still finds them |
| US3 | Peer sees shown email, not hidden DOC; other program withheld; other-member view audits |
| US4 | Admin sees Pathways + LEAD opted-in; hidden fields still omitted for Admin |
| US5 | 31st search in one minute returns 0 rows; another user is not blocked |

### Parallel opportunities

- T002, T003, T004 after T006 exists (write fail-first before T006, then implement T005–T008)
- T009–T011 together; T017–T020 together; T025–T026 together
- T035 and T036 in polish

### Parallel example: User Story 2 tests

```text
Task: "Write failing same-program list/search tests in tests/integration/directory-search.test.ts"
Task: "Mark view_directory built in tests/helpers/prd-matrix.ts and matrix test files"
Task: "Write failing hidden-field match unit tests in tests/unit/directory-search-match.test.ts"
Task: "Write failing unauthorized /app/directory cases in tests/app/unauthorized-routes.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational (T003 standalone EXECUTE file required)
3. Phase 3 US1 privacy
4. **STOP and VALIDATE** US1 independent test

### Incremental Delivery

US2 search → US3 profile → US4 staff both programs → US5 rate limit → polish / quickstart.

### Notes

- [P] = different files, no incomplete-task dependency
- Do not mock `requireRole` in role tests
- Do not add npm packages
- Do not widen `users_select`
- Do not match hidden fields then blank the row
- Status leaving `active` must **delete** shown-field copies (T003 case 4 + T006 trigger)
- Q2/Q12 remain named assumptions
