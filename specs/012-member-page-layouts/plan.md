# Implementation Plan: Member Page Layouts

**Branch**: `012-member-page-layouts` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-member-page-layouts/spec.md`

## Summary

`008` ported the theme's token values and `011` ported the frame. Neither touched what sits
inside the frame, so member page bodies still carry pre-design markup — which is what visual
review reported. This slice brings home, the resource library, and events up to the approved
design, completes the shared base layer `008` left behind, and removes the dark appearance in
favour of the single light appearance the design specifies.

Technical approach: finish the base layer in `app/globals.css` (one `.eyebrow` utility, one
`:focus-visible` rule, a selection treatment), delete the dark token block and declare
`color-scheme: light`, then build a small set of presentational pieces — page and section
headers, a badge primitive, a resource card, an event row, an announcement card, a reserved
panel — and rebuild the three page bodies from them. Three view models gain fields the design
needs and the schema already holds: resource size and format, event RSVP state and attendee
count, announcement posted date. Every derivation lands in `lib/`, so components receive
finished labels and carry no role logic. No new package, no migration, no client component
beyond what already exists.

## Technical Context

**Language/Version**: TypeScript strict, Next.js 15 App Router, React 19

**Primary Dependencies**: none added. Tailwind 3.4 theme from `008`; `next/link` only

**Storage**: PostgreSQL 16 via Prisma. **No migration.** Two existing columns are added to
existing `select` clauses (`Resource.fileSizeBytes`, `Resource.visibility`), and two reads are
added inside the existing `withRls` transaction on the event list

**Testing**: Vitest. New: `tests/unit/resource-derivations.test.ts`,
`tests/unit/audience-marker.test.ts`, `tests/unit/page-anatomy.test.ts`,
`tests/a11y/member-pages.test.ts`. Extended: `tests/integration/event-calendar.test.ts` for the
new RSVP and count fields. `pnpm test`, `pnpm test:rls`, `pnpm test:a11y` all run as gates

**Target Platform**: self-hosted Node 24 under systemd; browsers from 360px phones to desktop

**Performance Goals**: authenticated portal stays inside the 180 KB gzip budget (SC-012); page
content present in the first response (SC-011). This slice adds no client JavaScript

**Constraints**: no literal colour, font, spacing, or radius; ≥ 44×44 targets; no horizontal
scroll at 360px; `prefers-reduced-motion` honoured; authorization outcomes byte-identical before
and after (SC-010)

**Scale/Scope**: three page bodies, roughly eight new presentational files, four `lib/`
extensions, one token-file deletion, one base-layer addition

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see Post-Design Re-Check.*

| Principle | How this slice satisfies it | Status |
| --- | --- | --- |
| I. Defense-in-depth authorization | `visibilityTokens` is untouched, so all three layers behave exactly as before. The audience marker is a label derived from an item's stored visibility, applied to rows the member already receives; FR-010 and FR-032 forbid it gating anything, and SC-010 asserts the matrix is unchanged through the app and against Postgres | Pass |
| II. Privacy and audit stewardship | The only new personal value is the first name, already decrypted for the shell's display name and rendered in the same chrome. No email, title, or DOC affiliation. No analytics event, no audit action, no new outbound payload | Pass |
| III. Self-operated infrastructure | No hostname, bucket, region, or connection string. Thumbnails keep going through the existing authenticated handler; no object-storage URL is exposed. No `infra/` change | Pass |
| IV. Test-first permission proof | Derivation and anatomy tests are written failing first. The event list change touches content-table queries, so `pnpm test:rls` runs and must return identical results. `requireRole` is not mocked anywhere | Pass |
| V. Accessible, token-driven interface | Tokens only, proven by a source-level test. One `:focus-visible` base rule replaces per-component focus styling. Landmarks, heading order, real lists, labelled controls, ≥ 44×44, 360px, reduced motion. Server components throughout; no new `use client` | Pass |
| Stack constraints | No package added ([research.md](./research.md) §5, §8). `components/` stays presentational: every label, format, size, and audience string is computed in `lib/` | Pass |
| YAGNI | No icon library; no custom select; no live client-side filtering; no theme control; no blog or forum feature built to fill a column | Pass |

**New files and why extension was not possible** (Principle "prefer extending an existing
helper"):

- `components/ui/badge.tsx` — three uses need the same small bordered label at different tones.
  `button.tsx` carries interactive semantics and a 44px floor a static label must not have, and
  `card.tsx` exports only a class-name string. See [research.md](./research.md) §6.
- `components/page-header.tsx`, `components/section-header.tsx` — the framing is currently
  ad-hoc markup repeated per page, so there is nothing to extend. Centralising it is the point of
  FR-001 to FR-003.
- `components/event-row.tsx` — `components/event-calendar.tsx` is a client component holding the
  month grid and view toggle. Putting the row there would drag the design's row markup into a
  client bundle for no reason; as a server component it stays out of the bundle.
- `components/reserved-panel.tsx` — nothing comparable exists, and inlining the copy in the page
  would hide a product decision inside a layout.

Everything else is an extension: `app/globals.css`, `app/tokens.css`, `components/ui/icon.tsx`,
`components/resource-card.tsx`, `components/resource-filters.tsx`, `components/resource-list.tsx`,
`components/announcement-banners.tsx`, `lib/resources/list.ts`, `lib/events/list.ts`,
`lib/announcements/list.ts`, `lib/db/visibility.ts`, `lib/profile/identity.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/012-member-page-layouts/
├── plan.md               # This file
├── spec.md
├── research.md           # Phase 0 output — 16 decisions
├── data-model.md         # Phase 1 output — view-model extensions, derivation rules
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── page-anatomy.md   # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit-tasks output
```

### Source Code (repository root)

```text
app/
├── globals.css                          # EDIT: .eyebrow, :focus-visible, ::selection, balance
├── tokens.css                           # EDIT: delete dark block, add color-scheme: light
└── (member)/app/
    ├── page.tsx                         # REWRITE body: greeting, grid, previews, reserved panel
    ├── resources/page.tsx               # REWRITE body: header, filter band, card grid
    └── events/page.tsx                  # EDIT: header + rows

components/
├── page-header.tsx                      # NEW
├── section-header.tsx                   # NEW
├── event-row.tsx                        # NEW
├── reserved-panel.tsx                   # NEW
├── ui/badge.tsx                         # NEW
├── ui/icon.tsx                          # EDIT: 16 more glyphs
├── resource-card.tsx                    # REWRITE to design anatomy
├── resource-list.tsx                    # EDIT: two-column grid, empty state
├── resource-filters.tsx                 # EDIT: filter band, chip checkboxes
├── announcement-banners.tsx             # EDIT: emphasis card, posted date, drop own padding
└── directory-privacy-prompt.tsx         # EDIT: drop own padding

lib/
├── resources/list.ts                    # EDIT: size, format, audience
├── events/list.ts                       # EDIT: viewer RSVP, confirmed count, audience
├── announcements/list.ts                # EDIT: postedAt
├── db/visibility.ts                     # EDIT: audienceLabel
└── profile/identity.ts                  # EDIT: firstName

tests/
├── unit/resource-derivations.test.ts    # NEW
├── unit/audience-marker.test.ts         # NEW
├── unit/page-anatomy.test.ts            # NEW
├── a11y/member-pages.test.ts            # NEW
├── unit/shared-chrome.test.ts           # EDIT: resource-card anatomy moved on
├── a11y/resource-pages.test.ts          # EDIT: card fixture anatomy
└── integration/event-calendar.test.ts   # EDIT: assert new list fields
```

**Structure Decision**: unchanged App Router layout and route groups. The new presentational
pieces sit directly under `components/` rather than a new subdirectory, because unlike `011`'s
chrome they are page content used across several routes, and `AGENTS.md` already reserves
`components/` for exactly this. `components/shell/` stays chrome-only.

## Phase 0 — Research

Complete. See [research.md](./research.md). Sixteen decisions, no unresolved unknowns. Four are
load-bearing: the dark block is deleted rather than left inert and `color-scheme: light` is
declared (§1); filtering stays a server-side form with an explicit Apply rather than becoming a
client component (§7); the audience marker is a server-derived label that never gates (§10); and
the event list gains RSVP state and an attendee count, which is what pulls `pnpm test:rls` into
scope (§11).

Three deliberate deviations from the design reference are recorded there: no live filtering (§7),
the register control links to the event rather than posting from the list (§12), and the forum
activity block is omitted entirely while the blog column is reserved (§14).

## Phase 1 — Design & Contracts

Complete.

- [data-model.md](./data-model.md) — no schema change. Documents the four view-model extensions
  and every derivation rule, including the mime-to-format table and the byte-to-size thresholds.
- [contracts/page-anatomy.md](./contracts/page-anatomy.md) — required structure, landmarks, and
  accessibility obligations for the framing, the resource card, the filter band, the event row,
  the announcement card, and home's grid.
- [quickstart.md](./quickstart.md) — setup, the four gates, and a numbered manual pass covering
  appearance, framing, each page, and accessibility.

## Post-Design Re-Check

Re-evaluated after Phase 1. No new violations.

- The event list additions are the only queries that change. Both stay inside the existing
  `withRls` transaction, the RSVP read is the viewer's own composite key, and the attendee count
  aggregates only over events the viewer's tokens already reach. No RLS policy needs editing, but
  the matrix still runs both ways because the query surface moved.
- Adding `visibility` to the resource `select` returns the audience array to the server only; the
  derived label crosses to the component, the array does not.
- `fileSizeBytes` is a `BigInt` and must be converted in `lib/` before it reaches a component,
  since a `BigInt` cannot cross the serialization boundary. Recorded as a task-level detail.
- Removing the dark token block leaves both token tests passing, because each falls back to an
  empty override map and re-checks the light values. Verified before the decision was made.
  Both files get a short comment so a later reader is not misled into thinking dark is covered.
- `011` FR-014 required contrast to hold "in both the default appearance and the dark system
  appearance". With the dark appearance withdrawn, that clause is moot rather than violated; the
  light half of the pair is still asserted.

## Complexity Tracking

No constitution violations require justification. The table is intentionally empty.
