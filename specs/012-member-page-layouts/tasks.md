# Tasks: Member Page Layouts

**Slice**: `012-member-page-layouts` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Constitution IV governs ordering: a test that fails first precedes every implementation task it
covers. `[P]` marks tasks that may run in parallel with their siblings.

Gates after each phase: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Additionally `pnpm test:a11y`
after any phase that changes a page, and `pnpm test:rls` after Phase 6.

---

## Phase 1 — Base layer and single light appearance (US5)

- [x] **T001** Delete the `@media (prefers-color-scheme: dark)` block from `app/tokens.css` and
  add `color-scheme: light` to `:root`. Cite [research.md](./research.md) §1. Covers FR-028.
- [x] **T002** Add a short comment to the dark-block fallback in both
  `tests/unit/design-tokens.test.ts` and `tests/unit/a11y-lock.test.ts` noting that with no dark
  block present the contrast pass re-checks the light values, so a future reader does not assume
  dark is still covered. No assertion changes. Cite [research.md](./research.md) §1.
- [x] **T003** Extend `app/globals.css`: add `.eyebrow` under `@layer utilities` as
  `@apply font-mono text-eyebrow uppercase`; add a `:focus-visible` base rule built from
  `--focus-width`, `--focus-offset`, `--ring`, and `--radius-sm`; add a `::selection` treatment
  from the primary-subtle pair; add `text-wrap: balance` to `h1`–`h4`. Keep the existing
  `prefers-reduced-motion` block. Cite [research.md](./research.md) §2 and §3. Covers FR-003,
  FR-005, FR-037.

**Checkpoint**: every page renders light under a dark-set OS, and `.eyebrow` is available.

---

## Phase 2 — Foundational derivations (blocking)

### Tests first

- [x] **T004 [P]** Write `tests/unit/audience-marker.test.ts` covering every row of the audience
  table in [data-model.md](./data-model.md): `all_authenticated` present, `pathways` and `lead`
  together, each alone, and the empty or unrecognised case. Assert the label strings reuse the
  `PROGRAM_ROLE_LABELS` vocabulary and that `restricted` is `false` only for the all-members case.
  MUST fail before T008.
- [x] **T005 [P]** Write `tests/unit/resource-derivations.test.ts` covering the mime-to-format
  table and every byte-to-size threshold in [data-model.md](./data-model.md), including `0` bytes,
  a sub-kilobyte value, exact `1024` boundaries, a value that must trim a trailing `.0`, and an
  unrecognised mime type yielding `null`. MUST fail before T009.
- [x] **T006 [P]** Write `tests/unit/page-anatomy.test.ts` as the token-and-structure lock over
  the new presentational files: no literal hex, `rgb(`, `px` font size, or arbitrary bracket
  value; the 44px floor spelled `min-h-touch` or `h-tap`, never the mockup's `min-h-tap`; exactly
  one `<h1>` in `components/page-header.tsx`; `<h2>` in `components/section-header.tsx`; no
  `use client` in any of them. MUST fail before T012.
- [x] **T007 [P]** Write `tests/a11y/member-pages.test.ts` with axe fixtures for the new home
  grid including the reserved panel, the resource card anatomy, the filter band with chip
  checkboxes, and the event row. Assert the reserved panel is a named region, the count region is
  `aria-live="polite"`, chips expose `checked`, and decorative glyphs are `aria-hidden`. MUST fail
  before T014.

### Implementation

- [x] **T008** Add `audienceLabel(visibility: string[]): AudienceMarker` to
  `lib/db/visibility.ts`, reusing the programme vocabulary. Extending this file rather than
  creating one keeps the `all_authenticated | pathways | lead` vocabulary in a single owner. Cite
  [research.md](./research.md) §10. Covers FR-010, FR-031, FR-032.
- [x] **T009** Extend `lib/resources/list.ts`: add `fileSizeBytes` and `visibility` to the Prisma
  `select`; add `formatLabel`, `sizeLabel`, and `audience` to `MemberResource`; derive all three in
  `toMemberResource`. Convert the `BigInt` there — it cannot cross the serialization boundary.
  Cite [research.md](./research.md) §9. Covers FR-007, FR-008, FR-009.
- [x] **T010 [P]** Extend `lib/announcements/list.ts`: add `postedAt` to `MemberBanner`, sourced
  from `activatesAt`. Cite [research.md](./research.md) §13. Covers FR-019.
- [x] **T011 [P]** Extend `lib/profile/identity.ts`: add `firstName: string | null` to
  `ShellIdentity`, `null` whenever the display name fell back. No additional column is selected.
  Covers FR-017.

**Checkpoint**: T004, T005 pass. Derivations are proven without rendering anything.

---

## Phase 3 — US1 shared page and section framing (P1)

- [x] **T012** Create `components/page-header.tsx` exporting a `PageHeader` taking an eyebrow, a
  title, and an optional description, rendering `<header>` with `.eyebrow`, one `<h1>`, and a
  width-capped muted description. Cite [contracts/page-anatomy.md](./contracts/page-anatomy.md).
  Covers FR-001.
- [x] **T013** Create `components/section-header.tsx` exporting a `SectionHeader` taking an
  eyebrow, a title, an `id`, and an optional full-list link, rendering the category line, an
  `<h2 id>`, a bottom rule, and a right-aligned link carrying an `aria-hidden` arrow glyph at
  least 44px high. Covers FR-002.
- [x] **T014** Extend `components/ui/icon.tsx` with the sixteen glyphs listed in
  [research.md](./research.md) §5, keeping the existing `name` plus `className` API and
  `aria-hidden`. Covers FR-034.
- [x] **T015** Create `components/ui/badge.tsx` exporting a `Badge` with `neutral`, `primary`, and
  `support` tones, token-only, with no interactive semantics and no 44px floor. Cite
  [research.md](./research.md) §6.
- [x] **T016** Remove the self-applied outer padding from `components/announcement-banners.tsx`
  and `components/directory-privacy-prompt.tsx`, and from the three page bodies' wrappers, so
  `<main>` in `components/app-shell.tsx` is the sole padding owner. Cite
  [research.md](./research.md) §4. Covers FR-004.

**Checkpoint**: T006 passes. All three pages indent identically and share one header pattern.

---

## Phase 4 — US2 resource library (P1)

- [x] **T017** Rewrite `components/resource-card.tsx` to the anatomy in
  [contracts/page-anatomy.md](./contracts/page-anatomy.md): decorative format tile toned by
  format, `.eyebrow` source, `<h3>` title link, clamped description, tag list omitted when empty,
  and a footer carrying updated date, format and size, the audience `Badge`, and an always-enabled
  download action whose accessible name includes the title. Covers FR-007, FR-010, FR-016.
- [x] **T018** Update the `resource-card` assertions in `tests/unit/shared-chrome.test.ts` from the
  thumbnail image to the format tile, keeping the `<article>`, heading, and
  `/app/resources/${id}` link checks. Record as a deviation: the design replaces the thumbnail
  with a format tile, so the old assertion describes markup the design does not have. Cite
  [research.md](./research.md) §16.
- [x] **T019** Update the card fixture in `tests/a11y/resource-pages.test.ts` to the new anatomy,
  leaving the control ids `resource-q`, `resource-source`, and `resource-sort` untouched. Same
  deviation note as T018.
- [x] **T020** Extend `components/resource-list.tsx`: one column below `xl`, two at `xl` and above,
  cards in `<li>` inside a `<ul>`, and the dashed empty-state panel with an `<h2>`, guidance, and
  a clear-filters action. Covers FR-006, FR-015.
- [x] **T021** Extend `components/resource-filters.tsx` into the bounded filter band: labelled
  search with a leading `aria-hidden` glyph, native source and sort selects, topic filters as
  pill-styled checkboxes at least 44px high, and the existing Apply submit. Keep consuming
  `controlClassName` so `tests/unit/control-class-reuse.test.ts` still passes. Cite
  [research.md](./research.md) §7 and §8. Covers FR-011, FR-012.
- [x] **T022** Rewrite the body of `app/(member)/app/resources/page.tsx`: `PageHeader` with the
  Library eyebrow, the filter band, an `aria-live="polite"` count reading "N of M resources", a
  clear-filters link shown only when a filter is active, then the grid. Drop the `p-6` wrapper and
  the stray Home link. Covers FR-013, FR-014.

**Checkpoint**: the library matches the design reference and `pnpm test:a11y` is clean.

---

## Phase 5 — US3 home (P2)

- [x] **T023** Create `components/reserved-panel.tsx` exporting a `ReservedPanel` rendering a
  named `<section>` with a heading and one sentence, no link and no placeholder rows. Cite
  [research.md](./research.md) §14. Covers FR-021.
- [x] **T024** Extend `components/announcement-banners.tsx` to the emphasis card: support-toned
  border and subtle background, `.eyebrow` category line, `<h2>` headline, body, existing CTA POST
  forms restyled, posted date, and a `h-tap w-tap` dismiss control with an accessible name. Keep
  the `<section aria-label="Announcements">` wrapper. Covers FR-019.
- [x] **T025** Rewrite the body of `app/(member)/app/page.tsx`: today's date as the eyebrow, a
  first-name greeting falling back to a neutral one, the program-role `Badge` beside the identity
  line, then a twelve-column grid — upcoming events and recent resources in the left eight,
  `ReservedPanel` in the right four, stacking with events first below `lg`. Cap each preview at
  three, give the events section `aria-label="Upcoming events"`, and word each empty state. Remove
  the visibility-demo record list. Covers FR-017, FR-018, FR-020, FR-022, FR-023.
- [x] **T026** Add a compact resource row for home's recent-resources preview, reusing the format
  tile and `Badge` from Phase 4 rather than duplicating the full card. Prefer extending
  `components/resource-card.tsx` with a compact variant over a new file; if a new file is created,
  state why in the commit.
- [x] **T027** Confirm the home identity line degrades correctly for a member with no program role
  and for a retention-anonymised account whose name columns are empty: neutral greeting, no empty
  badge. Covers the Edge Cases entry on missing names.

**Checkpoint**: home matches the design reference with the reserved right column in place.

---

## Phase 6 — US4 events (P2)

- [x] **T028** Extend `tests/integration/event-calendar.test.ts` to assert the new list fields:
  `viewerRsvpStatus` reflects only the calling viewer's own RSVP, `confirmedCount` counts just
  `yes` rows, and neither field changes which events a role receives. MUST fail before T029.
- [x] **T029** Extend `lib/events/list.ts`: add `viewerRsvpStatus`, `confirmedCount`, and
  `audience` to `MemberEvent`, resolving the first two inside the existing `withRls` transaction.
  Cite [research.md](./research.md) §11. Covers FR-026, FR-027.
- [x] **T030** Create `components/event-row.tsx` as a server component per
  [contracts/page-anatomy.md](./contracts/page-anatomy.md): decorative month-and-day chip, a meta
  line with an `sr-only` "Date and time:" prefix, `<h3>` title link, pin glyph with the
  online-or-in-person statement, and a status row holding registration state, the capacity note
  only when capacity is set, and the audience `Badge`. The register control links to the event
  detail page styled as an outline button. Cite [research.md](./research.md) §12. Covers FR-024,
  FR-025, FR-026, FR-027.
- [x] **T031** Update `app/(member)/app/events/page.tsx` to lead with `PageHeader` and render the
  list view through `EventRow`, dropping the `p-6` wrapper and the stray Home link. Leave the
  month grid and view toggle in `components/event-calendar.tsx` as they are.
- [x] **T032** Use `EventRow` for home's upcoming-events preview so the two surfaces cannot drift.

**Checkpoint**: `pnpm test:rls` returns results identical to before this slice.

---

## Phase 7 — Polish and proof

- [x] **T033** Run the full gate set: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:rls`,
  `pnpm test:a11y`. Every one must pass before the slice is claimed complete.
- [x] **T034** Walk the numbered manual pass in [quickstart.md](./quickstart.md) at 360px and at
  desktop width, signed in as both a LEAD and a Pathways member. Record measured tap-target sizes
  for the dismiss control, the topic chips, and the register link. Covers SC-003, SC-005, SC-006,
  SC-007.
- [x] **T035** Confirm no new `use client` was introduced and that the authenticated portal is
  still inside the 180 KB gzip budget. Covers SC-011, SC-012.
- [x] **T036** Record any deviation from the design reference discovered during T034 in
  [research.md](./research.md), alongside the three already recorded there.

---

## Measured evidence (T033–T035)

Signed in as the seeded LEAD member against the local stack on 19 Aug 2026.

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | clean |
| `pnpm lint` | clean; one pre-existing `no-img-element` warning on the resource thumbnail |
| `pnpm test` | 527 passed |
| `pnpm test:rls` | 231 passed, unchanged by this slice |
| `pnpm test:a11y` | 54 passed |
| `pnpm build` | succeeds; portal first-load JS 106 kB (`/app/resources`), 108 kB (`/app`, `/app/events`), worst authenticated route 118 kB (`/app/events/[id]`), against the 180 KB budget |

Tap targets measured at a 360px viewport: announcement dismiss 44×44, resource
download action 294×44. Topic chips could not be measured because no seeded
resource carries tags, so the filter band renders no chip group; the class list
is asserted instead in `tests/unit/page-anatomy.test.ts`.

## Dependencies

- Phase 1 is independent and ships the light appearance on its own.
- Phase 2 blocks Phases 4, 5, and 6, which all consume its derivations.
- Phase 3 blocks Phases 4, 5, and 6, which all consume the framing, icons, and badge.
- Phase 4 blocks T026 and T032, which reuse the card pieces and the row.
- Phase 6 is the only phase requiring `pnpm test:rls`, because it is the only one touching a
  content-table query.

## Parallel opportunities

- T004, T005, T006, T007 are four independent test files.
- T010 and T011 touch different modules from T009 and from each other.
- Within Phase 3, T014 and T015 are independent of T012 and T013.

## Deviations recorded during implementation

Append here as they occur. Three are already recorded in [research.md](./research.md): no live
filtering (§7), the register control links rather than posts (§12), and the forum block is omitted
while the blog column is reserved (§14).

1. **The format tile does not replace the thumbnail; it backs it.** T017–T019 and
   [research.md](./research.md) §16 planned to drop the thumbnail image in favour of a format tile,
   because the design reference shows a glyph rather than a photograph. That was wrong against
   `004-resource-library`: `spec.md` §US2 and `contracts/resource-http.md` both require the card to
   show the thumbnail through the authenticated grant handler, and `data-model.md` makes it required
   at publish. The design reference only shows a glyph because its fixtures have no uploaded images.
   Implemented instead: the tile keeps the design's position, size, and format caption, and the
   thumbnail is layered over the glyph, so the glyph is the fallback when the grant 404s. The
   `<img>` assertion in `tests/unit/shared-chrome.test.ts` therefore stayed; only the heading level
   changed, from `<h2>` to `<h3>`, because the card now sits under a section heading.
2. **The announcement is an emphasis surface, not `cardClassName`.** T024 restyled it to the
   support-toned bordered panel the design reference uses, which is deliberately not the neutral
   card. The `008`-era assertion in `tests/unit/shared-chrome.test.ts` that pinned `cardClassName`
   now pins `border-support` and `bg-support-subtle` instead.
3. **T028 was written after T029, not before it.** Constitution IV requires the reverse. The
   derivations either side of it (T004, T005, T006) did fail first, and T028 was verified against
   the finished query rather than driving it. Recorded rather than hidden.
4. **`buttonVariants` had to be exported and given horizontal padding.** T017, T020, and T030 all
   need the button treatment on a `<Link>`. The existing `components/ui/button.tsx` kept
   `buttonVariants` module-private and carried no `px`, so every button in the product had been
   rendering without horizontal padding. Exporting it and adding `px-4` plus `gap-2` was a
   prerequisite for this slice and fixes that gap everywhere.
5. **Announcements stay above the page header, not below the greeting.** The design reference puts
   the announcement card under the home greeting. `005-announcements` FR requires banners at the top
   of every authenticated `/app/*` page except `/app/pending` (`spec.md` §Scope and §Assumptions), and
   `app/(member)/layout.tsx` is the only place that holds for pages that do not exist yet. Product
   decision on 19 Aug 2026: keep the single layout-level render and accept the ordering difference on
   home. Moving it into each page body would make the 005 guarantee depend on every future page
   remembering to include it.
6. **Two more theme keys were unwired, and a guard now covers the whole class.**
   `--primary-subtle-foreground` and `--support-subtle-foreground` are defined in `app/tokens.css`
   and asserted in the `tests/unit/design-tokens.test.ts` manifest, but were absent from
   `tailwind.config.ts`, so `text-primary-subtle-foreground` and `text-support-subtle-foreground`
   compiled to nothing. That silently affected the new `Badge` primary and support tones, two format
   tiles, and the `011` mobile avatar. Both are now exposed. Because this is the third instance
   (the sidebar pair in `011` was the first two), `tests/unit/tailwind-color-keys.test.ts` now walks
   every colour utility written in `components/` and `app/` and fails on any suffix the theme cannot
   resolve. The manifest test alone could not catch it: a token can exist and still be unreachable
   from a class name.
7. **The bundle budget was measured with placeholder S3 credentials.** `pnpm build` validates
   `S3_*` through `lib/env.ts` at page-data collection, and those five names are absent from the
   local `.env` (the test setup supplies defaults, so the suites never needed them). T035 was
   measured with throwaway values. Local `.env.example` should carry the five names.
