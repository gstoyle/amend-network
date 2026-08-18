# Tasks: Design Tokens

**Input**: Design documents from `/specs/008-design-tokens/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV and [plan.md](./plan.md) Required standalone tasks. Write the listed tests first and confirm they **fail** before implementation.

**Organization**: Setup → Foundational (tokens + theme + fonts; blocks all stories) → US1 shared chrome → US2 form-field inheritance → US3 a11y/behavior lock → polish.

**Look only.** Do not change component structure, roles, labels, handlers, routes, schema, or authorization. Do not port mockup `PortalShell` / `DesktopSidebar` / `BottomTabBar`. Do not add npm packages. Do not add a `tokens.json` pipeline or an in-app theme switcher. Do not `@import` `mockup/**` or `fonts.googleapis.com`.

**Standalone file**: T002 is its own task and file. Do **not** fold it into a generic “update CSS” item.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US3) on story-phase tasks only
- Every task has a concrete file path

## Path Conventions

Repository-root Next.js app per plan.md (`app/`, `components/`, `tests/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new packages. Confirm mockup stays out of the Next app.

- [x] T001 Verify `tsconfig.json` `exclude` and `eslint.config.mjs` ignores still cover `mockup/**`, and `package.json` gains **no** new dependencies (Geist comes from `next/font/google` already in Next 15)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Single brand token file, theme mapping, self-hosted Geist, OS dark via media query. **No user story chrome work until this phase is complete.**

**⚠️ CRITICAL**: Blocks US1–US3

### Tests (fail first)

- [x] T002 Write failing tests in `tests/unit/design-tokens.test.ts` that (1) `app/tokens.css` defines every custom property in [contracts/token-manifest.md](./contracts/token-manifest.md); (2) light `--primary` is mockup `--evergreen-700` (`#1f4d3f`) and light `--background` is `--stone-100` (`#f4f1eb`); (3) contrast pairs in [contracts/contrast.md](./contracts/contrast.md) meet the stated ratios in light and dark; (4) `tailwind.config.ts` maps listed colors to `var(--*)` and does **not** wrap them in `hsl()`; (5) `components/ui/*.tsx` contain no hex / `rgb(` / `hsl(` literals. Assert the cases in those contracts. This task MUST stay standalone.

### Implementation

- [x] T003 Copy primitive + semantic tokens from `mockup/src/styles/tokens.css` into `app/tokens.css` (complete colors, not HSL channels). Apply mockup `:root.dark` semantic overrides inside `@media (prefers-color-scheme: dark)` on `:root`. Set `--font-body` / `--font-heading` / `--font-mono` to `var(--font-geist-sans)` / `var(--font-geist-mono)` plus system fallbacks. Cite [research.md](./research.md) §1 and §3 and [contracts/token-manifest.md](./contracts/token-manifest.md).
- [x] T004 Import `./tokens.css` from `app/globals.css`; remove HSL-channel `:root` / `prefers-color-scheme` placeholders; set body to token background/foreground/font; keep existing `prefers-reduced-motion` rules.
- [x] T005 [P] Extend `tailwind.config.ts` per [contracts/theme-mapping.md](./contracts/theme-mapping.md): colors as `var(--*)` (add `primary-hover`, `support`, `success`/`warning`/`info`, `border-strong`, sidebar); fontFamily/fontSize/spacing/radius/shadow/motion from tokens; `minHeight.touch` / `minWidth.touch` / `spacing.tap` = `--tap-target`. Drop `hsl(var(--…))` wrappers and `calc(var(--radius) - 2px)`.
- [x] T006 [P] Load Geist and Geist Mono via `next/font/google` in `app/layout.tsx` (`variable: "--font-geist-sans"` / `"--font-geist-mono"`, `subsets: ["latin"]`, `display: "swap"`) and put those variables on `<html>`. No Google `<link>` or CSS `@import`. Cite [research.md](./research.md) §4.

**Checkpoint**: T002 cases (1)–(4) pass. Case (5) may still fail until US1. `pnpm typecheck` still succeeds. User stories may start.

---

## Phase 3: User Story 1 - Shared chrome looks like Amend (Priority: P1) 🎯 MVP

**Goal**: Buttons, fields, labels, cards, nav, and layout chrome from 002–007 use the mockup token set. Same markup and behavior; new look.

**Independent Test**: Open sign-in, a member card page (resources or directory), and admin chrome. Surfaces, accent, type, spacing, and corners match mockup chrome — not the old teal placeholder. Same fields and links remain.

### Implementation for User Story 1

- [x] T007 [P] [US1] Restyle `components/ui/button.tsx` with token utilities only (`bg-primary`, `hover:bg-primary-hover`, ring/focus tokens). Keep variants and `min-h-touch` / `min-w-touch`. No structure/prop changes.
- [x] T008 [P] [US1] Restyle `components/ui/input.tsx` with token border/radius/focus; export `controlClassName` for native select/textarea reuse. Keep `min-h-touch`. Cite [contracts/shared-chrome.md](./contracts/shared-chrome.md).
- [x] T009 [P] [US1] Restyle `components/ui/label.tsx` with token type/color only.
- [x] T010 [US1] Add presentational card classes in `components/ui/card.tsx` (`bg-card`, `border-border`, radius, shadow tokens). Export a helper usable on an existing `<article>` — do not force an extra wrapper. Cite [research.md](./research.md) §5.
- [x] T011 [P] [US1] Apply card tokens on the existing `<article>` in `components/resource-card.tsx` (classes only; keep Link/img/heading structure).
- [x] T012 [P] [US1] Apply card tokens on the existing `<article>` in `components/announcement-banners.tsx` (classes only).
- [x] T013 [US1] Apply layout chrome tokens (background, border, gutter padding, type) on `app/(member)/layout.tsx` header/nav/main. Do not add a sidebar or bottom bar. Keep the same links and `min-h-touch` on nav.
- [x] T014 [P] [US1] Apply the **same** token set on `app/(admin)/layout.tsx` header/nav/main (one brand, not a second skin).

**Checkpoint**: Spec US1 independent test passes. T002 case (5) passes for `components/ui/*.tsx`.

---

## Phase 4: User Story 2 - Brand change is a token change (Priority: P1)

**Goal**: Semantic token changes update shared fields without editing each 002–007 form. Duplicated `fieldClassName` / `selectClassName` strings point at `controlClassName`.

**Independent Test**: Change `--primary` in `app/tokens.css`, refresh login and a member shell — shared primary chrome updates with zero page edits. Forms that used copied input classes now import `controlClassName`.

### Tests for User Story 2 ⚠️ fail first

- [x] T015 [US2] Write failing tests in `tests/unit/control-class-reuse.test.ts` that `components/register-form.tsx`, `components/invite-form.tsx`, `components/invite-complete-form.tsx`, `components/resource-form.tsx`, `components/announcement-form.tsx`, `components/event-form.tsx`, `components/pending-queue.tsx`, and `components/resource-filters.tsx` import `controlClassName` from `@/components/ui/input` (no local duplicated `border-input` / `bg-background` control strings).

### Implementation for User Story 2

- [x] T016 [US2] Replace duplicated `fieldClassName` / `selectClassName` with `controlClassName` from `components/ui/input.tsx` in `components/register-form.tsx`, `components/invite-form.tsx`, `components/invite-complete-form.tsx`, `components/resource-form.tsx`, `components/announcement-form.tsx`, `components/event-form.tsx`, `components/pending-queue.tsx`, and `components/resource-filters.tsx`. Markup and handlers unchanged.

**Checkpoint**: Spec US2 independent test passes. T015 passes.

---

## Phase 5: User Story 3 - Behavior and accessibility stay the same (Priority: P2)

**Goal**: Journeys, permissions, 44×44 targets, contrast, and reduced-motion still hold after the restyle.

**Independent Test**: Existing `pnpm test` / `pnpm test:a11y` still pass. Shared controls still ≥ 44×44. Contrast pairs already asserted in T002.

### Implementation for User Story 3

- [x] T017 [P] [US3] Confirm `min-h-touch` / `min-w-touch` remain on `components/ui/button.tsx`, `components/ui/input.tsx`, `components/member-initials.tsx`, and member nav links in `app/(member)/layout.tsx`; restore if a prior restyle dropped them. `--tap-target` stays `2.75rem` in `app/tokens.css`.
- [x] T018 [P] [US3] Confirm `prefers-reduced-motion` rules remain in `app/globals.css`; do not remove them while cleaning HSL placeholders.

**Checkpoint**: Spec US3 independent test (same steps/outcomes; contrast and tap targets) holds in code. Full suite run is polish T020.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Leftover placeholder theme, regression suites.

- [x] T019 [P] Remove leftover `hsl(var(` / HSL-channel placeholders from `app/globals.css` and `tailwind.config.ts` if any remain; do not rewrite unique page layouts in `app/(member)/app/**` or `app/(admin)/admin/**` beyond shared chrome already covered.
- [x] T020 Run [quickstart.md](./quickstart.md) locally (`pnpm test` including `tests/unit/design-tokens.test.ts` and `tests/unit/control-class-reuse.test.ts`, `pnpm test:rls`, `pnpm test:a11y`, `pnpm typecheck`, `pnpm lint`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup. T002 fail-first before T003–T006. **BLOCKS** US1–US3
- **US1 (Phase 3)**: Depends on Foundational (tokens + theme live)
- **US2 (Phase 4)**: Depends on US1 T008 (`controlClassName` export)
- **US3 (Phase 5)**: Depends on US1 chrome (tap targets must still be present)
- **Polish**: Depends on US1–US3

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — MVP look on shared chrome
- **User Story 2 (P1)**: After US1 T008 — form inheritance; independently testable by swapping `controlClassName` usage
- **User Story 3 (P2)**: After US1 — a11y/behavior lock; contrast already in T002

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Shared primitives (`components/ui/*`) before applying them to resource-card / banners / forms
- Story complete before moving to next priority

### Parallel Opportunities

- T005 and T006 after T002 (different files from T003/T004)
- T007, T008, T009 together
- T011 and T012 after T010
- T014 with T013
- T017 and T018 together

### Parallel example: User Story 1 primitives

```text
Task: "Restyle components/ui/button.tsx with token hover/focus"
Task: "Restyle components/ui/input.tsx and export controlClassName"
Task: "Restyle components/ui/label.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational (T002 standalone `design-tokens.test.ts` required)
3. Phase 3 US1 shared chrome
4. **STOP and VALIDATE**: sign-in + member shell + admin chrome match mockup tokens

### Incremental Delivery

1. Setup + Foundational → token file and theme live
2. US1 → shared chrome looks like Amend (MVP)
3. US2 → forms inherit `controlClassName`
4. US3 → tap / reduced-motion lock
5. Polish / quickstart

### Notes

- [P] = different files, no incomplete-task dependency
- Do not add npm packages
- Do not change Prisma, `requireRole`, RLS, or analytics
- Do not port mockup layout components
- T002 case (5) is expected to stay red until US1 `components/ui` restyle
- `tokens.json` / WordPress manifest remains out of scope
