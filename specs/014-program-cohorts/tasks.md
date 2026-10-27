---

description: "Task list for Programme Cohorts"
---

# Tasks: Programme Cohorts

**Input**: Design documents from `specs/014-program-cohorts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required. Constitution IV is test-first: each test task is written and seen failing before its implementation task.

**Organization**: By user story. US1 and US2 are P1; US3 and US5 are P2; US4 is P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1?US5 from spec.md

---

## Phase 1: Setup

- [x] T001 Confirm constitution 1.1.0 is in place in `.specify/memory/constitution.md`, `AGENTS.md`, and `.cursor/rules/000-project.mdc` (done 2026-10-27; verify only)
- [x] T002 [P] Add the six cohort audit actions (`cohort_created`, `cohort_renamed`, `cohort_archived`, `cohort_unarchived`, `cohort_member_added`, `cohort_member_removed`) to `lib/audit/actions.ts`, and extend the `tests/integration/audit-writer.test.ts` expectations

---

## Phase 2: Foundational (blocks every story)

**Purpose**: Cohort tokens exist end to end (schema, database tokens, session claims, shared parser) with no user-visible change.

### Tests first

- [x] T003 [P] RLS token derivation rows RLS-COH-TOK-1..5 in new `tests/rls/cohort-tokens.test.ts` (fail before T006)
- [x] T004 [P] RLS content rows RLS-COH-VIS-1..5 and RLS-COH-W-6 for resources, events, announcements, and forum categories in new `tests/rls/cohort-visibility.test.ts`
- [x] T005 [P] Unit tests for `parseVisibilityTokens`, `visibilityTokens` with `cohortIds`, and `audienceLabel` with cohort names in `tests/unit/visibility-tokens.test.ts` and `tests/unit/audience-marker.test.ts`

### Implementation

- [x] T006 Write migration `prisma/migrations/20261027120000_program_cohorts/migration.sql`. It must:
  - add `networks.archived_at`
  - define `visibility_tokens_valid(text[])` and swap the `*_visibility_check` constraints on resources, events, announcements, and forum_categories (forum keeps its `all_authenticated` exclusion)
  - add a SECURITY DEFINER `app_member_cohort_tokens()` and extend `app_role_tokens()` (all cohort tokens for moderator)
  - extend the audit action CHECK with the six actions
  - add a `user_networks` primary-row BEFORE DELETE guard trigger that is skipped when called from `sync_user_network_membership`
  - add `networks` INSERT/UPDATE and `user_networks` INSERT/DELETE grants and policies for admin/super_admin, with a definer check that the target's `program_role <> 'none'`
- [x] T007 Add `archivedAt DateTime? @map("archived_at") @db.Timestamptz(6)` to `Network` in `prisma/schema.prisma`, then run `pnpm prisma generate`
- [x] T008 Add `cohortIds: string[]` to `SessionClaims` in `lib/auth/types.ts`, and load it in `insertSession`/`loadSession` in `lib/auth/session.ts` (memberships; every cohort id for moderator)
- [x] T009 In `lib/db/visibility.ts`:
  - append `cohort:<id>` tokens in `visibilityTokens`
  - add `COHORT_TOKEN` regex, `parseVisibilityTokens(values)` (Zod), and `assertCohortTargets(tx, next, previous)` (must exist; newly added cohorts must be active)
  - change `audienceLabel(visibility, cohortNames)` to name cohorts
- [x] T010 [P] Create `lib/cohorts/list.ts` with `cohortNameMap()` (React `cache`), `listCohortOptions({ includeArchived })` grouped by programme, and `audienceTokensForGroup(group)` (shared by US4 and US5)
- [x] T011 Point `parseVisibility` in `lib/announcements/validate.ts` at the shared parser, and remove the local `VISIBILITY` constants in `lib/resources/publish.ts` and `lib/resources/edit.ts`. `lib/events/validate.ts` and `lib/forum/validate.ts` re-export it unchanged.
- [x] T012 Update every `audienceLabel` caller to pass `await cohortNameMap()`: `app/(admin)/admin/{resources,events,announcements}/page.tsx`, `lib/resources/list.ts`, `lib/events/list.ts`, `lib/announcements/list.ts`, `lib/forum/list.ts`
- [x] T013 Add `20261027120000_program_cohorts` to `RETRY_FAILED_MIGRATIONS` in `scripts/render.mjs`
- [x] T014 Run `pnpm typecheck`, `pnpm test`, and `pnpm test:rls`. T003?T005 pass, and existing suites are unchanged (SC-005).

**Checkpoint**: Cohort tokens are enforced in the database and the app. Nothing in the UI targets them yet.

---

## Phase 3: User Story 1 - Staff manage cohorts and memberships (P1) ?? MVP

**Goal**: Admins create, rename, archive, and unarchive cohorts, and add or remove extra memberships, without a developer.

**Independent Test**: spec.md US1. Quickstart steps 1, 2, and 4.

### Tests first

- [x] T015 [P] [US1] RLS write rows RLS-COH-W-1..5 in new `tests/rls/cohort-writes.test.ts`
- [x] T016 [P] [US1] Integration test in new `tests/integration/cohort-manage.test.ts`. It covers:
  - create, duplicate name (case-insensitive), rename, archive, and unarchive, each writing its audit row with ids only
  - add a member by email, with the same generic refusal for an unknown email, a staff-only account, or an existing member
  - removing the primary cohort is refused
  - moderator and member callers are refused (the role check isn't mocked)
- [x] T017 [P] [US1] Integration tests: archived cohorts are excluded from registration and invite choices, and the invite CSV rejects an archived `network_name`. Add these to `tests/integration/register.test.ts` and `tests/integration/invite-send.test.ts`.
- [x] T018 [P] [US1] a11y test for `/admin/cohorts` and `/admin/cohorts/[id]` in new `tests/a11y/cohort-pages.test.ts`

### Implementation

- [x] T019 [US1] Create `lib/cohorts/manage.ts`: `createCohort`, `renameCohort`, `setCohortArchived`, `listCohortsForAdmin` (with member counts), `listCohortMembers` (decrypted names, primary flag), `addCohortMember` (email lookup hash), `removeCohortMember`. Use `requireRole` admin/super_admin with `mfa: true`, Zod inputs, and audit in the same transaction. Mirror `lib/registration/doc-affiliations.ts`.
- [x] T020 [US1] Filter `archivedAt: null` in the network option loaders in `lib/registration/register.ts` and `lib/registration/invite.ts`, and in invite CSV name resolution
- [x] T021 [P] [US1] Create presentational `components/cohort-list.tsx` (grouped by programme, add, rename, and archive forms) and `components/cohort-members.tsx` (member list, add by email, remove), using tokens only
- [x] T022 [US1] Create `app/(admin)/admin/cohorts/page.tsx` with server actions following `app/(admin)/admin/users/affiliations/page.tsx`
- [x] T023 [US1] Create `app/(admin)/admin/cohorts/[id]/page.tsx` with add and remove member actions. An unknown id returns `notFound()`.
- [x] T024 [US1] Add the Cohorts destination to `lib/nav/destinations.ts` and its description to `app/(admin)/admin/page.tsx`
- [x] T025 [US1] Seed *Norway Sept 26* and *Norway April 27* (GLE), with a member in each and one archived example, in `prisma/seed.ts`
- [ ] T026 [US1] Run the gates (lint, typecheck, test, test:rls, test:a11y) and quickstart steps 1, 2, and 4 in the browser

**Checkpoint**: Cohorts can be opened for registration and maintained. Content still targets programmes only.

---

## Phase 4: User Story 2 - Publish to specific cohorts (P1)

**Goal**: Resources, events, and announcements can target cohorts, with separation enforced at all three layers.

**Independent Test**: spec.md US2. Quickstart step 3.

### Tests first

- [x] T027 [P] [US2] Integration tests for cohort-only resources (list, search, open, download, direct URL), events (list, ICS, RSVP, join-link reveal), and announcements (banner). Add these to `tests/integration/resource-visibility.test.ts`, `tests/integration/event-calendar.test.ts`, and `tests/integration/announcement-visibility.test.ts`.
- [x] T028 [P] [US2] Integration tests for publish and edit validation: an unknown cohort is refused, newly adding an archived cohort is refused, and keeping an already-present archived cohort is allowed. Add these to `tests/integration/resource-publish.test.ts`, `tests/integration/event-publish.test.ts`, and `tests/integration/announcement-publish.test.ts`.
- [x] T029 [P] [US2] Add RLS rows for a moderator seeing every cohort and a member seeing the union of their cohorts to `tests/rls/permission-matrix.test.ts`, per `contracts/permission-matrix.md`

### Implementation

- [x] T030 [US2] Call `assertCohortTargets` inside the write transaction in `lib/resources/publish.ts`, `lib/resources/edit.ts`, `lib/events/publish.ts`, `lib/announcements/publish.ts`, and `lib/announcements/edit.ts`
- [x] T031 [US2] Make sure member queries filter with the full `visibilityTokens(claims)`, including cohort tokens, in `lib/resources/list.ts`, `lib/resources/download.ts`, `lib/resources/folders.ts`, `lib/events/list.ts`, `lib/events/rsvp.ts`, and `lib/announcements/list.ts`
- [x] T032 [P] [US2] Create `components/visibility-fieldset.tsx`. It renders *Everyone signed in* (optional), the programmes, and the cohorts grouped by programme in fieldsets with legends, marking archived cohorts that are already selected as "(archived)".
- [x] T033 [US2] Replace the static `VISIBILITY_OPTIONS` rendering in `components/resource-form.tsx`, `components/event-form.tsx`, and `components/announcement-form.tsx` with `VisibilityFieldset`. Pass the options from the server pages: `app/(admin)/admin/{resources,events,announcements}/{new,[id]}/page.tsx`.
- [x] T034 [US2] Add a11y coverage for the updated forms to `tests/a11y/resource-pages.test.ts`, `tests/a11y/event-pages.test.ts`, and `tests/a11y/announcement-pages.test.ts`
- [ ] T035 [US2] Run the gates and quickstart steps 3 and 4 in the browser

**Checkpoint**: Cohort separation works for every non-forum content type.

---

## Phase 5: User Story 3 - Cohort forum rooms (P2)

**Goal**: Admins can create forum rooms visible to specific cohorts. The directory gate and moderation behave as they do today.

**Independent Test**: spec.md US3. Quickstart step 5.

- [ ] T036 [P] [US3] Add RLS rows to `tests/rls/forum-policies.test.ts`:
  - a listed cohort member can insert a thread or post in a cohort room
  - a listed member of another cohort in the same programme can't select or insert
  - an unlisted cohort member can't insert
  - a moderator can moderate
- [ ] T037 [P] [US3] Unit tests in `tests/unit/forum-validate.test.ts`: `parseForumCategoryVisibility` accepts cohort tokens and still rejects `all_authenticated`
- [ ] T038 [US3] Widen `parseForumCategoryVisibility` in `lib/forum/validate.ts` to accept cohort tokens, and call `assertCohortTargets` in `lib/forum/categories.ts`
- [ ] T039 [US3] Render `VisibilityFieldset` (without *Everyone signed in*) in the category form in `app/(admin)/admin/forum/page.tsx`
- [ ] T040 [US3] Run the gates and quickstart step 5 in the browser

---

## Phase 6: User Story 5 - Filter admin content by group (P2)

**Goal**: The admin Resources, Events, and Announcements lists filter by programme or cohort, with a "targeted only" option.

**Independent Test**: spec.md US5. Quickstart step 7.

- [x] T041 [P] [US5] Unit tests for `audienceTokensForGroup` (cohort, programme, unknown ? All) in new `tests/unit/cohort-groups.test.ts`
- [ ] T042 [P] [US5] Add tests for the `{ group, targeted }` option to `tests/integration/resource-edit.test.ts`, `tests/integration/event-edit-cancel.test.ts`, and `tests/integration/announcement-admin.test.ts`. They cover reach mode, targeted mode, no duplicate rows for multi-cohort items, and a moderator on events.
- [ ] T043 [US5] Accept `{ group?: string; targeted?: boolean }` in `listAdminResources` (`lib/resources/publish.ts`), `listAdminEvents` (`lib/events/publish.ts`), and `listAdminAnnouncements` (`lib/announcements/publish.ts`). Filter with `hasSome` / `has` in the query.
- [ ] T044 [P] [US5] Create presentational `components/admin-group-filter.tsx`: a GET form with a labelled select (All, programmes, cohorts with archived labelled) and a "Targeted only" checkbox
- [ ] T045 [US5] Wire `?group=&targeted=` (Zod-parsed) into `app/(admin)/admin/{resources,events,announcements}/page.tsx`, and add a filtered empty state ("Nothing published for this group yet.")
- [ ] T046 [US5] Add a11y coverage for the filter to `tests/a11y/resource-pages.test.ts`, then run the gates and quickstart step 7 in the browser

---

## Phase 7: User Story 4 - Directory cohorts (P3)

**Goal**: Directory listings show cohort names, and members can filter by cohort within their programmes.

**Independent Test**: spec.md US4. Quickstart step 6.

- [ ] T047 [P] [US4] RLS rows RLS-COH-DIR-1..4 for `directory_listing_cohorts(uuid[])` in new `tests/rls/directory-cohorts.test.ts`
- [ ] T048 [P] [US4] Add integration tests for cohort labels, the filter narrowing results, and out-of-programme cohort values being ignored to `tests/integration/directory-search.test.ts`
- [ ] T049 [US4] Add SECURITY DEFINER `directory_listing_cohorts(uuid[])` in a new migration, `prisma/migrations/20261027130000_directory_cohorts/migration.sql`, and add it to `RETRY_FAILED_MIGRATIONS` in `scripts/render.mjs`
- [ ] T050 [US4] Attach `cohortLabels` and apply the `cohort` filter in `lib/directory/list.ts`. Search also matches cohort names.
- [ ] T051 [US4] Add the cohort filter select and the cohort labels on listing cards to the directory page and listing component under `app/(member)/app/directory/` and `components/`. Update `tests/a11y/directory-pages.test.ts`.
- [ ] T052 [US4] Run the gates and quickstart step 6 in the browser

---

## Phase 8: Polish & Cross-Cutting

- [ ] T053 [P] Add Guide articles in `lib/guide/articles.ts`:
  - member: what a cohort is, cohort-only items, cohort rooms, the directory filter
  - staff: managing cohorts and memberships, targeting, and the admin group filter
  - extend `tests/unit/guide.test.ts`
- [ ] T054 [P] Update the Q3 entry in `docs/decisions/assumptions-log.md`: cohorts are managed, and the cohort-hidden-from-same-trip default awaits Amend confirmation
- [ ] T055 [P] In `tests/unit/analytics.test.ts`, assert that no cohort name reaches analytics payloads (cohort ids only). In `tests/unit/audit-metadata.test.ts`, assert that the cohort audit metadata stays off the PII denylist.
- [ ] T056 Run the full quickstart (`specs/014-program-cohorts/quickstart.md`) and `pnpm build`

---

## Dependencies & Execution Order

- **Setup (T001?T002)** ? **Foundational (T003?T014)**, which blocks every story
- **US1 (T015?T026)**: after Foundational. MVP.
- **US2 (T027?T035)**: after Foundational. It needs cohort rows to test with: use the US1 seed (T025) or fixtures created in tests.
- **US3 (T036?T040)**: after US2, which provides `VisibilityFieldset` (T032)
- **US5 (T041?T046)**: after Foundational. It uses `audienceTokensForGroup` (T010) and can run alongside US2 and US3.
- **US4 (T047?T052)**: after Foundational. Independent of the others.
- **Polish (T053?T056)**: after the chosen stories

### Parallel examples

- Foundational tests T003, T004, and T005 together; then T010 alongside T008 and T009
- US1: T015, T016, T017, and T018 together; T021 alongside T019 and T020
- After US1: US2 and US5 in parallel; US4 in parallel with either

## Implementation Strategy

1. **MVP**: Setup, then Foundational, then US1. Staff can open and manage cohorts, and nothing changes for members. Deploy.
2. **Separation**: US2 (cohort-only resources, events, announcements). Deploy. This is the client's core ask.
3. **Staff convenience and community**: US5 and US3. Deploy.
4. **Directory**: US4. Deploy.
5. Polish, then the full quickstart.
