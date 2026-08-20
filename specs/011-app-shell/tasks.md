# Tasks: Authenticated App Shell

**Input**: Design documents from `/specs/011-app-shell/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and spec FR-022 require fail-first proof. Write the listed tests first and confirm they **fail** before implementation. Do not mock `requireRole`; role correctness is proven against a pure function over real `SessionClaims`.

**Organization**: Setup → Foundational (blocks all stories) → user stories in spec order (US1–US5) → polish.

**No data, no dependency, no client component.** Do not add a package ([research.md](./research.md) §1). Do not add `use client` to any chrome file. Do not add a table, column, migration, RLS policy, audit action, or analytics event. Do not edit any page body.

**Do not change authorization.** `middleware.ts`, `lib/auth/requireRole.ts`, and every route's own checks stay exactly as they are. FR-010 and SC-007 assert outcomes are byte-identical.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are given in each description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Expose the two token values `008` defined but never wired, so chrome classes resolve.

- [x] T001 Add `"accent-foreground": "var(--sidebar-accent-foreground)"` and `"primary-foreground": "var(--sidebar-primary-foreground)"` to the `sidebar` colour group in `tailwind.config.ts`. Both custom properties already exist in `app/tokens.css` light and dark blocks — do not add token values, only theme keys ([research.md](./research.md) §8)
- [x] T002 [P] Verify `.gitignore`, `.dockerignore`, and `eslint.config.mjs` `ignores` still cover `node_modules/`, `dist/`, `.env*`, `*.log` (append only if a required pattern is missing). Confirm `mockup/**` stays excluded from lint so its React Router source is never compiled

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure destination module, the identity read, and the icon primitive. Every story depends on these.

**CRITICAL**: No user story work begins until this phase is complete.

- [x] T003 [P] Write failing unit tests in `tests/unit/app-shell-nav.test.ts` per [contracts/navigation.md](./contracts/navigation.md): member session yields zero admin destinations; pending session yields no member destinations and sign out only; `mfaSatisfied: false` does **not** remove admin destinations; a claims object with an extra browser-supplied role field changes nothing; `isCurrent` marks `/app` only on exact match and marks Events current for `/app/events/<id>`; longest-href wins when two could match
- [x] T004 [P] Write failing unit tests in `tests/unit/app-shell.test.ts` for token discipline on chrome files, using the same `forbiddenLiteral` regex as `tests/unit/shared-chrome.test.ts` (no `#hex`, `rgb(`, `hsl(`, or bare `px`), plus `min-h-touch` present and `min-h-tap` absent. Allow the single `env(safe-area-inset-bottom)` exception in `components/shell/bottom-tab-bar.tsx` ([research.md](./research.md) §10)
- [x] T005 Implement `lib/nav/destinations.ts` exporting pure `memberDestinations(claims)`, `adminDestinations(claims)`, `accountDestinations(claims)`, and `isCurrent(path, destination)` per [contracts/navigation.md](./contracts/navigation.md) and [data-model.md](./data-model.md). Synchronous, no database read, no `headers()` call. Forum is **not** emitted. Do not emit `/app/profile` — it has no route
- [x] T006 [P] Implement `lib/profile/identity.ts` exporting `loadShellIdentity(session)` returning `displayName`, `initials`, `programRoleLabel` only. Read through `withRls` with the caller's own `userId`; select the name column only — never email, DOC affiliation, or title (FR-018). Return a neutral fallback for an empty or `010`-anonymized name. Do not add PII to `SessionClaims` ([research.md](./research.md) §6)
- [x] T007 [P] Implement `components/ui/icon.tsx` with the fixed inline SVG set (home, resources, events, directory, account, sign out, shield). Every glyph `aria-hidden="true"` and `focusable="false"`, stroked with `currentColor`, sized with token spacing. Lucide (ISC) attribution in the file header. No package install

**Checkpoint**: destinations and identity are unit-provable. No chrome exists yet.

---

## Phase 3: User Story 1 - A member always knows where they are (Priority: P1) — MVP

**Goal**: Persistent desktop side navigation listing the member destinations available to the session, with the current section marked, and the account destinations gathered in one place.

**Independent Test**: Sign in as an approved member at desktop width. The sidebar lists Home, Resources, Events, Directory. Opening Resources marks Resources current; opening a single resource keeps Resources current. Privacy, sessions, and sign out are reachable from the sidebar footer on every page.

### Tests for User Story 1

- [x] T008 [P] [US1] Write failing a11y tests in `tests/a11y/shell.test.ts` for the desktop case per [contracts/shell-chrome.md](./contracts/shell-chrome.md): skip link is the first focusable element and precedes navigation; `nav` and `main` landmarks present; the current entry carries `aria-current="page"`; zero axe violations; no `h1` introduced by chrome

### Implementation for User Story 1

- [x] T009 [US1] Implement `components/shell/desktop-sidebar.tsx` — fixed 256px, `hidden lg:flex`, `bg-sidebar` with right border; brand block linking to `/app`; identity block; `<nav aria-label="Primary">` with a `ul`/`li`/`a` list; footer with the shared-device notice and the existing `LogoutButton`. Current entry gets `aria-current="page"`, `bg-sidebar-accent text-sidebar-accent-foreground`, and a non-colour marker. Every entry `min-h-touch`. Props only — no data fetching, no role logic
- [x] T010 [US1] Implement `components/app-shell.tsx` composing skip link → sidebar → `<main id="main-content">` bounded by `max-w-content` with `lg:pl-64`, gutter padding, and `pb-24 lg:pb-16` clearance. Accepts destinations, identity, and current path as props
- [x] T011 [US1] Rewrite `app/(member)/layout.tsx` to resolve claims as it does today, read the current path from `headers().get("x-pathname")`, call `lib/nav/destinations.ts` and `loadShellIdentity`, and render `AppShell` around `children`. Keep the existing pending redirect and `AnnouncementBanners` exactly as they are. Delete the inline link row
- [x] T011a [US1] Update the member-layout cases in `tests/unit/shared-chrome.test.ts` **and** `tests/unit/a11y-lock.test.ts`. Both pin the five inline `href` strings in `app/(member)/layout.tsx`, and `shared-chrome` additionally asserts `not.toMatch(/PortalShell|BottomTabBar|DesktopSidebar/)` — all of which encode "the shell does not exist", which `008` scoped out and this slice delivers. Keep every token-discipline, tap-target, and `forbiddenLiteral` assertion, relocating them onto the shell components and `lib/nav/destinations.ts`, which is now the single source for the link set. **These are the two existing tests FR-022 cannot leave untouched; record as a deviation**
- [x] T012 [US1] Render the minimal frame for `status = pending` — brand, identity, sign out, no destinations (FR-019). Confirm `/app/pending` still renders and still redirects as before

**Checkpoint**: desktop shell is live and inspectable via `pnpm dev`. Spec US1 independent test passes. SC-005.

---

## Phase 4: User Story 2 - The shell works on a phone (Priority: P1)

**Goal**: A compact top bar and a fixed bottom tab bar below `lg`, usable at 360px with nothing trapped under fixed chrome.

**Independent Test**: Load member home, a list page, and a form at 360px. Bottom navigation is present and the sidebar is not. Scroll to the end of a long page and the final content is readable. No horizontal scroll. Every chrome target measures at least 44×44.

### Tests for User Story 2

- [x] T013 [P] [US2] Extend `tests/a11y/shell.test.ts` with the mobile case: bottom navigation exposes `nav` with an accessible name, each item keeps a **text label** alongside the decorative icon (FR-023), the current item carries `aria-current="page"`, and the top bar's account control has an accessible name that includes the person's name. Zero axe violations
- [x] T014 [P] [US2] Extend `tests/unit/app-shell.test.ts` to assert `components/shell/bottom-tab-bar.tsx` contains `env(safe-area-inset-bottom)` and that `components/app-shell.tsx` applies bottom clearance so content is not covered

### Implementation for User Story 2

- [x] T015 [P] [US2] Implement `components/shell/mobile-top-bar.tsx` — sticky, `lg:hidden`, `bg-card` with bottom border; brand block linking to `/app`; account control with an accessible name including the display name; initials avatar `aria-hidden`. Omit the mockup's search shortcut unless it points at an existing search screen. Targets `min-h-touch min-w-touch`
- [x] T016 [P] [US2] Implement `components/shell/bottom-tab-bar.tsx` — fixed bottom, `lg:hidden`, `bg-card`, top border, `shadow-bar`; `<nav aria-label="Primary">` over an equal-width `ul`; each item stacks indicator, icon, and text label; `padding-bottom: env(safe-area-inset-bottom)`; `min-h-touch` per item. Member destinations only — never an administrative one
- [x] T017 [US2] Wire both into `components/app-shell.tsx` in the DOM order given by [contracts/shell-chrome.md](./contracts/shell-chrome.md), relying on `lg:hidden` / `lg:flex` so exactly one navigation landmark is in the accessibility tree at any viewport ([research.md](./research.md) §2)

**Checkpoint**: full responsive shell. Spec US2 independent test passes. SC-001, SC-002, SC-006. **This is the stop-and-look point.**

---

## Phase 5: User Story 3 - Staff reach admin tools without leaving the product (Priority: P2)

**Goal**: Administrative pages use the same shell, with administrative destinations as their own labelled group and member destinations still reachable.

**Independent Test**: Sign in as an Admin with MFA satisfied. An Admin entry appears in the account area, administrative screens carry the same shell, and member destinations remain present without switching modes.

### Tests for User Story 3

- [ ] T018 [P] [US3] Extend `tests/unit/app-shell-nav.test.ts`: `adminDestinations` mirrors each administrative route's own `requireRole` narrowing and never widens it — a Moderator does not receive a destination whose route denies a Moderator ([contracts/navigation.md](./contracts/navigation.md))
- [ ] T019 [P] [US3] Extend `tests/a11y/shell.test.ts` with the admin case: two labelled `nav` groups coexist with distinct accessible names, zero axe violations

### Implementation for User Story 3

- [x] T020 [US3] Extend `components/shell/desktop-sidebar.tsx` to render an administrative group in its own labelled `<nav>` below the member group when destinations are present. No second sidebar component, no separate admin skin
- [x] T021 [US3] Rewrite `app/(admin)/layout.tsx` to render `AppShell` with both member and administrative groups. Keep the existing `adminMfaDestination` redirect untouched. Delete the inline link row
- [x] T021a [US3] Update the admin-layout case in `tests/unit/shared-chrome.test.ts` for the same reason as T011a, preserving its token-discipline assertions

**Checkpoint**: one shell across member and admin. Spec US3 independent test passes. PRD §B.5.

---

## Phase 6: User Story 4 - Navigation shows only what the person may open (Priority: P2)

**Goal**: Prove, not assume, that chrome never advertises a destination the session cannot open.

**Independent Test**: Render every authenticated page for a Pathways member, a pending user, and an Admin. The member and pending outputs contain no administrative destination anywhere.

### Tests for User Story 4

- [ ] T022 [P] [US4] Write failing tests in `tests/app/shell-role-visibility.test.ts` that render the shell for each role fixture from `tests/helpers/prd-matrix` and assert zero occurrences of `/admin` in member and pending output (SC-004). Use real claims; do not mock `requireRole`
- [ ] T023 [P] [US4] Extend `tests/app/unauthorized-routes.test.ts` with an assertion that hiding a destination changed no authorization outcome — every route denied before is denied now, with the same generic message (FR-010, SC-007)

### Implementation for User Story 4

- [ ] T024 [US4] Resolve any gap the two tests expose in `lib/nav/destinations.ts` only. Do not fix a visibility failure inside a component — role filtering has exactly one home

**Checkpoint**: SC-004 and SC-007 hold. Spec US4 independent test passes.

---

## Phase 7: User Story 5 - Usable by keyboard and assistive technology (Priority: P2)

**Goal**: Skip link, focus visibility, landmark structure, current-destination announcement, and reduced motion, verified rather than asserted.

**Independent Test**: With a keyboard only, load a member page, use the skip mechanism, tab through the shell, activate a destination. Run the accessibility scan across member and admin pages with zero shell violations.

### Tests for User Story 5

- [ ] T025 [P] [US5] Extend `tests/unit/a11y-lock.test.ts` with the sidebar accent pair (`--sidebar-accent-foreground` on `--sidebar-accent`) and the bottom-bar current pair, checked numerically in both light and dark values. The jsdom axe harness disables colour-contrast, so this is where contrast is actually proven ([research.md](./research.md) §12)
- [ ] T026 [P] [US5] Extend `tests/a11y/shell.test.ts` to assert focus order — skip link first, then navigation — and that heading order is unbroken when the shell wraps a page whose own `h1` is inside `main`

### Implementation for User Story 5

- [ ] T027 [US5] Close any contrast or focus-order gap the tests expose, using token classes only. If a needed value is genuinely absent from `app/tokens.css`, stop and raise it — FR-017 forbids inventing one

**Checkpoint**: `pnpm test:a11y` green on shell chrome. Spec US5 independent test passes. SC-003, SC-008.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Regression proof and the quickstart walkthrough.

- [ ] T028 [P] Confirm no chrome file contains `use client` and no package was added — diff `package.json` and `pnpm-lock.yaml` to prove both are untouched (FR-021, [research.md](./research.md) §13)
- [ ] T029 [P] Confirm `pnpm test:rls` still reports its existing file and test counts, unchanged. This slice touches no policy; the run exists to prove SC-007
- [ ] T030 Run [quickstart.md](./quickstart.md) commands: `pnpm test`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`. `test:a11y` **is** required for this slice
- [ ] T031 Walk the eight manual inspection steps in [quickstart.md](./quickstart.md) with `pnpm dev` — desktop, mobile at 360px, keyboard, role check, staff, pending, light and dark appearance, reduced motion

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **BLOCKS US1–US5**
- **US1 (Phase 3)**: depends on Foundational — MVP
- **US2 (Phase 4)**: depends on US1, because both edit `components/app-shell.tsx`
- **US3 (Phase 5)**: depends on US1, because it extends `desktop-sidebar.tsx`
- **US4 (Phase 6)**: depends on US1 and US3 — needs both destination groups rendering to count occurrences
- **US5 (Phase 7)**: depends on US1 and US2 — needs both navigation patterns present
- **Polish (Phase 8)**: after the desired stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Foundational modules before chrome; chrome before layout wiring
- Run the full suite after each task, not only at the end of a phase

### Parallel Opportunities

- T003 ∥ T004 (different test files)
- T006 ∥ T007 after T005 (`lib/profile/` and `components/ui/` are independent)
- T015 ∥ T016 (different chrome files) — but **not** with T017, which edits `app-shell.tsx`
- T018 ∥ T019, T022 ∥ T023, T025 ∥ T026
- T009 ∥ T020 is **not** available — both edit `desktop-sidebar.tsx`

---

## Implementation Strategy

### Visible-first (US1 + US2)

1. Phase 1 Setup, Phase 2 Foundational
2. Phase 3 US1 — desktop sidebar live
3. Phase 4 US2 — mobile bars live
4. **STOP and LOOK**: `pnpm dev`, walk quickstart manual steps 1–3
5. Continue to US3–US5

This is the shortest path to something inspectable, and it is where the visual change actually lands. US3–US5 harden it.

### Notes

- `[P]` means different files with no incomplete dependency
- Verify tests fail before implementing — Constitution Principle IV
- Avoid: adding a package, adding `use client` to chrome, editing a page body, changing a `requireRole` call, introducing `min-h-tap`, hard-coding a colour or spacing value
