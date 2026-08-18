# Tasks: Event Calendar

**Input**: Design documents from `/specs/006-event-calendar/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and spec FR-026/FR-027 require test-first permission proof. Write the listed tests first and confirm they **fail** before implementation. Do not mock `requireRole` in tests whose purpose is to verify it.

**Organization**: Setup → Foundational (blocks all stories) → user stories in spec order (US1–US7) → polish.

**Shared RLS core**: T004 (failing function-shape tests) + T006 (migration installs `event_visible_core(uuid)`, `event_join_revealed(uuid)`, and `event_promote_oldest_waitlist(uuid)` from [contracts/rls-policies.md](./contracts/rls-policies.md)). Event SELECT / RSVP INSERT-UPDATE / join-link SELECT **call those functions**. Do not paste cancelled + `visibility && app_role_tokens()` a second time in policy SQL. Do **not** add a `virtual_link` column on `events`.

**Standalone promote EXECUTE**: T003 is its own task and file. Do **not** fold it into T002. Helper-path waitlist tests (US3) do not satisfy T003.

**Moderator**: Unlike announcements, Moderator **may** create/edit/cancel events (PRD §3). MFA still required on `/admin/events*`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US7) on story-phase tasks only
- Every task has a concrete file path

## Path Conventions

Repository-root Next.js app per plan.md (`app/`, `lib/`, `prisma/`, `tests/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new packages. Confirm ignore files already cover Node/Docker/env from prior slices.

- [x] T001 Verify `.gitignore`, `.dockerignore`, and `eslint.config.mjs` `ignores` already include `node_modules/`, `dist/`, `.env*`, `*.log` (append only if a required pattern is missing)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Event tables, **one** `event_visible_core` function, join-link reveal function, waitlist promotion function, RLS policies that reference them, seed fixtures. **No user story work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US7

### Tests (fail first)

- [x] T002 [P] Write failing RLS tests in `tests/rls/events-policies.test.ts` for SELECT visibility/cancel, INSERT/UPDATE allowed for admin/super_admin/**moderator**, RSVP INSERT/UPDATE own-row + `event_visible_core`, join-link SELECT (Yes + window vs Maybe / too-early / other cohort), and direct `EXECUTE event_visible_core` / `event_join_revealed` as Pathways on a LEAD-only id → false. `requireRole` is not in this file. Cite [contracts/rls-policies.md](./contracts/rls-policies.md). **Do not put `event_promote_oldest_waitlist` cases in this file.**
- [x] T003 [P] Write failing tests in `tests/rls/event-promote-oldest-waitlist.test.ts` that `SELECT event_promote_oldest_waitlist($1::uuid)` as `amend_app` (raw SQL, **not** `lib/events` RSVP helper). Caller GUCs are a Pathways member who is **not** staff and **not** any waitlisted user. Cover same-cohort and cross-cohort fixtures from [contracts/rls-policies.md](./contracts/rls-policies.md) § Direct EXECUTE. Assert: (1) `pronargs = 1` and oldest waitlist on **that** event only is promoted (W2 and other-event W3 untouched); (2) LEAD-only event with a free seat returns SQL NULL and updates 0 rows; (3) same-cohort event at capacity returns SQL NULL and updates 0 rows. This task MUST stay standalone.
- [x] T004 [P] Write failing unit tests in `tests/unit/event-visible-core.test.ts` that `event_visible_core(uuid)` is a single SQL function (query `pg_proc`), that events SELECT / event_rsvps INSERT-UPDATE / event_join_links SELECT policy definitions in `pg_policies` contain `event_visible_core` or `event_join_revealed` as specified and do **not** duplicate cancelled + `app_role_tokens()` inline, that `event_join_revealed` and `event_promote_oldest_waitlist` **call** `event_visible_core`, and that `event_promote_oldest_waitlist` has `pronargs = 1`.

### Implementation

- [x] T005 Define `Event`, `EventRsvp`, and `EventJoinLink` in `prisma/schema.prisma` per [data-model.md](./data-model.md) (visibility GIN, no user FK, RSVP PK `(userId, eventId)`, join-link PK `eventId`, **no** `virtualLink` on Event)
- [x] T006 Add migration in `prisma/migrations/` that creates the three tables, checks, GIN, ENABLE/FORCE RLS, grants, **and** functions `event_visible_core(uuid)`, `event_join_revealed(uuid)`, `event_promote_oldest_waitlist(uuid)` copied from [contracts/rls-policies.md](./contracts/rls-policies.md). CREATE POLICY statements MUST reference those functions — do not duplicate the core predicates. Same migration as the policies; not a later follow-up. `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO amend_app` on each function. `REVOKE DELETE` on all three tables.
- [x] T007 Add event fixture cleanup in `tests/helpers/event-cleanup.ts` (delete by title prefix, same pattern as announcement cleanup)
- [x] T008 Seed shared / Pathways / LEAD / both-program uncancelled events, one cancelled, virtual events inside and outside the reveal window, and a capacity=1 event in `prisma/seed.ts`

**Checkpoint**: `pnpm db:migrate` and `pnpm db:seed` succeed. T002/T003/T004 pass. Existing `002`/`003`/`004`/`005` tests still pass. User stories may start.

---

## Phase 3: User Story 1 - Staff publish a visibility-targeted event (Priority: P1) 🎯 MVP

**Goal**: MFA-satisfied Admin, Super Admin, or Moderator creates an event with title, allowlisted description, start/end, visibility, optional location / virtual join URL / capacity / host. Members in the visibility set can see it; others cannot.

**Independent Test**: As Admin, create one shared and one Pathways-only event. Both appear on `/admin/events`. Pathways sees both; LEAD sees only shared. Pathways cannot open `/admin/events/new`. Moderator **can** open create.

### Tests for User Story 1 ⚠️ fail first

- [x] T009 [P] [US1] Write failing create success/validation tests in `tests/integration/event-publish.test.ts`
- [x] T010 [P] [US1] Write failing unauthorized deny for `/admin/events*` (Pathways, LEAD, Pending) and MFA-required staff in `tests/app/unauthorized-routes.test.ts`. Moderator must be **allowed** (unlike announcements).
- [x] T011 [P] [US1] Mark `create_edit_delete_events` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`

### Implementation for User Story 1

- [x] T012 [US1] Implement markdown allowlist + URL/window/length validation in `lib/events/validate.ts`
- [x] T013 [US1] Implement create (INSERT event + optional `event_join_links` + `event_created` same transaction) in `lib/events/publish.ts`
- [x] T014 [US1] Build presentational form (no role logic) in `components/event-form.tsx`
- [x] T015 [US1] Build `/admin/events` and `/admin/events/new` with `requireRole({ admin: ["admin", "super_admin", "moderator"], mfa: true })` in `app/(admin)/admin/events/page.tsx` and `app/(admin)/admin/events/new/page.tsx`
- [x] T016 [US1] Add Events link on `app/(admin)/admin/page.tsx`

**Checkpoint**: Spec US1 independent test passes.

---

## Phase 4: User Story 2 - Members browse month and list calendar (Priority: P1)

**Goal**: `/app/events` month + list of uncancelled visible events; upcoming list on member home; detail without leaking join URLs.

**Independent Test**: Shared + Pathways-only + LEAD-only events. Pathways sees shared + Pathways in both views; LEAD sees shared + LEAD; pending sees none.

### Tests for User Story 2 ⚠️ fail first

- [x] T017 [P] [US2] Write failing calendar/home/detail visibility tests in `tests/integration/event-calendar.test.ts`
- [x] T018 [P] [US2] Mark `view_events` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`

### Implementation for User Story 2

- [x] T019 [US2] Implement visibility-filtered list (cancelled omitted for members) in `lib/events/list.ts`
- [x] T020 [US2] Build month/list toggle leaf (no role logic) in `components/event-calendar.tsx` and page `app/(member)/app/events/page.tsx`
- [x] T021 [US2] Build detail page (omit join URL until US7) in `app/(member)/app/events/[id]/page.tsx`
- [x] T022 [US2] Show upcoming visible events on `app/(member)/app/page.tsx`

**Checkpoint**: Spec US2 independent test passes.

---

## Phase 5: User Story 3 - RSVP Yes / No / Maybe with capacity and waitlist (Priority: P1)

**Goal**: One RSVP row per user per event. Yes consumes capacity; overflow Yes becomes waitlist; freeing a Yes seat promotes oldest waitlist via `event_promote_oldest_waitlist`. Audit + analytics.

**Independent Test**: Capacity 1. First Pathways Yes succeeds. Second Yes is waitlisted. First switches to No; second is promoted to Yes.

### Tests for User Story 3 ⚠️ fail first

- [x] T023 [P] [US3] Write failing RSVP / waitlist / withhold / change-answer tests in `tests/integration/event-rsvp.test.ts` (helper path; does **not** replace T003)
- [x] T024 [P] [US3] Mark `rsvp_events` built in `tests/helpers/prd-matrix.ts`, `tests/app/permission-matrix.test.ts`, and `tests/rls/permission-matrix.test.ts`
- [x] T025 [P] [US3] Write failing unauthorized RSVP POST cases in `tests/app/unauthorized-routes.test.ts`

### Implementation for User Story 3

- [x] T026 [US3] Extend `lib/analytics/track.ts` with `event_viewed` / `event_rsvp`, allowlisted `eventId` / `rsvpStatus` (`yes|no|maybe|waitlist`), and denylist `description` / `location` / `virtualLink`
- [x] T027 [US3] Implement RSVP upsert (row lock, waitlist, call `event_promote_oldest_waitlist`, `event_rsvp` audit, `track`) in `lib/events/rsvp.ts`
- [x] T028 [US3] Implement POST `/app/events/[id]/rsvp` in `app/(member)/app/events/[id]/rsvp/route.ts`
- [x] T029 [US3] Build RSVP leaf (no role logic) in `components/event-rsvp.tsx` and wire it on `app/(member)/app/events/[id]/page.tsx`; record `event_viewed` on successful detail load

**Checkpoint**: Spec US3 independent test passes. T003 still required and green.

---

## Phase 6: User Story 4 - Staff edit, notify RSVPs, and cancel (Priority: P2)

**Goal**: In-place edit; time-change notify dialog + optional message; soft cancel hides from members, retains rows, mails all RSVPs.

**Independent Test**: Create event, two Yes RSVPs, change start with a notify message, then cancel. Both members mailed twice; calendar omits the event.

### Tests for User Story 4 ⚠️ fail first

- [ ] T030 [P] [US4] Write failing edit / capacity-shrink warn / time-change notify / cancel tests in `tests/integration/event-edit-cancel.test.ts`

### Implementation for User Story 4

- [ ] T031 [US4] Implement edit (including capacity-shrink warning, no silent Yes demotion) in `lib/events/edit.ts`
- [ ] T032 [US4] Implement cancel (`cancelled_at`, `event_cancelled`, retain RSVPs) in `lib/events/cancel.ts`
- [ ] T033 [US4] Extend `lib/email/transport.ts` with event time-change and cancel kinds (no join URL in copy)
- [ ] T034 [US4] Build `/admin/events/[id]` edit + cancel + notify dialog in `app/(admin)/admin/events/[id]/page.tsx`

**Checkpoint**: Spec US4 independent test passes.

---

## Phase 7: User Story 5 - Calendar file download and Yes invite (Priority: P2)

**Goal**: Authenticated ICS after `requireRole`. Yes (or promotion) sends one invite. Join URL omitted until FR-020.

**Independent Test**: Pathways downloads ICS for a visible event (times + address, no virtual URL). RSVP Yes → invite email also omits the URL while more than 1h remains.

### Tests for User Story 5 ⚠️ fail first

- [ ] T035 [P] [US5] Write failing ICS withhold/contents tests in `tests/integration/event-ics.test.ts`
- [ ] T036 [P] [US5] Write failing in-process ICS unit tests (omit join URL; escape text) in `tests/unit/event-ics.test.ts`

### Implementation for User Story 5

- [ ] T037 [US5] Implement RFC 5545 subset builder (no new npm package) in `lib/events/ics.ts`
- [ ] T038 [US5] Implement GET `/app/events/[id]/ics` in `app/(member)/app/events/[id]/ics/route.ts`
- [ ] T039 [US5] Extend `lib/email/transport.ts` with Yes-invite kind and send it from `lib/events/rsvp.ts` on Yes and on promotion (omit join URL unless reveal would succeed)

**Checkpoint**: Spec US5 independent test passes.

---

## Phase 8: User Story 6 - 24-hour Yes reminder (Priority: P2)

**Goal**: `runEventReminders(now)` emails current Yes on uncancelled events in the 24h window once (`reminder_sent_at`). Production crontab out of scope.

**Independent Test**: Yes / Maybe / waitlist on one event. Frozen `now` at T−24h. Only Yes is reminded, once.

### Tests for User Story 6 ⚠️ fail first

- [ ] T040 [P] [US6] Write failing reminder tests (inject `now`; cancelled skip; idempotent) in `tests/integration/event-reminders.test.ts`

### Implementation for User Story 6

- [ ] T041 [US6] Implement `runEventReminders(now)` in `lib/events/reminders.ts` and add reminder kind in `lib/email/transport.ts` (never include join URL at T−24h)

**Checkpoint**: Spec US6 independent test passes. No host crontab required.

---

## Phase 9: User Story 7 - Virtual join link only for Yes near start (Priority: P2)

**Goal**: Detail / ICS / mail reveal the join URL only when RLS `event_join_revealed` would return the row.

**Independent Test**: Virtual LEAD-only event. LEAD Yes more than 1h before start: no link. Inside the last hour: link. LEAD Maybe inside the window: no link. Pathways: withhold.

### Tests for User Story 7 ⚠️ fail first

- [ ] T042 [P] [US7] Write failing reveal tests (detail, ICS, mail; other-cohort withhold) in `tests/integration/event-join-reveal.test.ts`

### Implementation for User Story 7

- [ ] T043 [US7] Implement join-link read (query `event_join_links` after `requireRole`; never a field on the `events` DTO) in `lib/events/join-link.ts`
- [ ] T044 [US7] Wire reveal into `app/(member)/app/events/[id]/page.tsx`, `lib/events/ics.ts`, and Yes-invite mail in `lib/events/rsvp.ts`

**Checkpoint**: Spec US7 independent test passes. SC-008.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T045 [P] Axe fixtures for `/app/events*`, `/app` upcoming, and `/admin/events*` in `tests/a11y/event-pages.test.ts`
- [ ] T046 [P] Extend payload allow/deny cases in `tests/unit/analytics.test.ts` for `event_viewed` / `event_rsvp`
- [ ] T047 Run [quickstart.md](./quickstart.md) locally (`pnpm test`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`)

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: Ignore-file verify
- **Foundational (Phase 2)**: Blocks all stories. T006 (shared SQL functions) is required before T002/T003/T004 can pass.
- **US1 → US2 → US3 → US4 → US5 → US6 → US7 → Polish**: sequential in this repo (same files). Tests fail first within each story.
- **MVP**: Phase 1–3 (staff publish). Calendar, RSVP, edit/cancel, ICS, reminders, and reveal follow.

### User story independent tests

| Story | Independent test |
| --- | --- |
| US1 | Admin creates shared + Pathways; Pathways sees both; LEAD sees shared only; Pathways denied admin create; Moderator allowed |
| US2 | Month + list + home show the same visibility-filtered uncancelled set |
| US3 | Capacity 1 → Yes then waitlist then promote on No |
| US4 | Time-change notify + cancel mails RSVPs; members omit cancelled |
| US5 | ICS + Yes invite omit join URL more than 1h before start |
| US6 | Frozen T−24h reminds Yes once; Maybe/waitlist/cancelled skip |
| US7 | Yes inside window sees link; Maybe / too-early / other cohort do not |

### Parallel opportunities

T002/T003/T004 after T006 exists they will fail until T006; write tests first then T005–T008. T009/T010/T011 [P]. T017/T018 [P]. T023/T024/T025 [P]. T035/T036 [P]. T045/T046 [P] after pages exist.

---

## Implementation Strategy

1. Setup + Foundational (`event_visible_core` + reveal + promote in the **same** migration as policies; T003 standalone)
2. US1 MVP (create + admin new; Moderator allowed)
3. US2 calendar + home + detail
4. US3 RSVP / waitlist (helper path; T003 remains the EXECUTE proof)
5. US4 edit / notify / cancel
6. US5 ICS + Yes invite
7. US6 `runEventReminders(now)`
8. US7 join-link reveal on surfaces
9. a11y + analytics unit + quickstart

Do not add an `ics` npm package, a new `authMode`, a `virtual_link` column on `events`, a T−1h “link ready” email, or production crontab.
