# Implementation Plan: Authenticated App Shell

**Branch**: `011-app-shell` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-app-shell/spec.md`

## Summary

Give every authenticated page the frame PRD Appendix §B.4 describes: a fixed left sidebar at desktop widths, a sticky top bar plus fixed bottom tab bar below them, and a single bounded main region. Navigation is built on the server from the signed session's roles, so a member never sees an administrative destination. Administrative pages use the same shell, satisfying PRD §B.5's rule that staff are never forced to pick a mode.

Technical approach: a presentational `components/app-shell.tsx` composed from three chrome pieces, fed by a pure `lib/nav/destinations.ts` and a narrow `lib/profile/identity.ts`. Both existing layouts render it. No client components, no new package, no data, no query changes — links and CSS only, so the shell works from first paint and stays inside the interface budget. Visual structure is ported from `/mockup`; every value resolves through the `008` token set, with two already-defined sidebar tokens exposed in the Tailwind theme that `008` left unwired.

## Technical Context

**Language/Version**: TypeScript strict, Next.js 15 App Router, React 19

**Primary Dependencies**: none added. Tailwind 3.4 theme from `008`; `next/link`, `next/headers` only

**Storage**: none. No table, column, migration, or query change

**Testing**: Vitest — `tests/unit/app-shell-nav.test.ts` (role correctness), `tests/unit/app-shell.test.ts` (token discipline), `tests/a11y/shell.test.ts` (axe). Existing `pnpm test`, `pnpm test:rls`, `pnpm test:a11y` run unchanged as regression gates

**Target Platform**: self-hosted Node 24 under systemd; browsers from 360px phones to desktop

**Project Type**: web application, server-rendered

**Performance Goals**: authenticated shell stays inside the 180 KB gzip budget (Principle V); LCP ≤ 2.5s at p75 on 4G (SC-010). Shell adds zero client JavaScript

**Constraints**: no `use client` in chrome; no hard-coded colour, font, radius, or spacing; ≥ 44×44 targets; no horizontal scroll at 360px; `prefers-reduced-motion` honored; authorization outcomes byte-identical before and after

**Scale/Scope**: two layouts, roughly six new presentational files, two `lib/` helpers, two Tailwind theme keys. 33 existing pages inherit the frame with no page edits

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see Post-Design Re-Check.*

| Principle | How this slice satisfies it | Status |
| --- | --- | --- |
| I. Defense-in-depth authorization | Navigation is built from `SessionClaims` on the server; a client-supplied role has no path into it. Hiding an entry is presentation only — layer 1 middleware, layer 2 `requireRole`, and layer 3 RLS are untouched, and FR-010 / SC-007 assert outcomes are identical | Pass |
| II. Privacy and audit stewardship | Chrome shows display name and program role only. Email, DOC affiliation, and title are excluded by FR-018. PII is not added to `SessionClaims` ([research.md](./research.md) §6). No audit action, no analytics event | Pass |
| III. Self-operated infrastructure | No hostname, bucket, region, or connection string. No new outbound call. No `infra/` change | Pass |
| IV. Test-first permission proof | Three test files written and failing before the shell exists. `requireRole` is not mocked; role correctness is proven against a pure function over real claims. Full suite runs after each task | Pass |
| V. Accessible, token-driven interface | Tokens only, verified by a source-level test. Landmarks, skip link, `aria-current`, ≥ 44×44, 360px, reduced motion. Server components throughout; the sole client leaf is the existing logout button | Pass |
| Stack constraints | No package added ([research.md](./research.md) §1). `components/` stays presentational; role logic lives in `lib/` | Pass |
| YAGNI | No icon library for six static glyphs; no client viewport detection; no route-group merge; no theme switcher | Pass |

**New files and why extension was not possible** (Principle "prefer extending an existing helper"):

- `lib/nav/destinations.ts` — no helper owns navigation. `requireRole` decides access, not presentation; merging the two would blur enforcement with chrome.
- `lib/profile/identity.ts` — `loadSession` would cost no extra query but would put PII on the authorization type carried by every role check. `loadDirectoryPrivacy` returns a privacy-form model, omits the name column, and is not called by most pages. See [research.md](./research.md) §6.
- `components/app-shell.tsx` and the three chrome pieces — the current chrome is inline markup duplicated across two layouts; there is nothing to extend.
- `components/ui/icon.tsx` — no icon primitive exists.

## Project Structure

### Documentation (this feature)

```text
specs/011-app-shell/
├── plan.md              # This file
├── spec.md
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── navigation.md
│   └── shell-chrome.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks output, not created here
```

### Source Code (repository root)

```text
app/
├── (member)/layout.tsx          # EDIT: render AppShell instead of inline header
├── (admin)/layout.tsx           # EDIT: render AppShell with admin group
└── tokens.css                   # unchanged

components/
├── app-shell.tsx                # NEW: composes the three chrome pieces + main
├── shell/
│   ├── desktop-sidebar.tsx      # NEW
│   ├── mobile-top-bar.tsx       # NEW
│   └── bottom-tab-bar.tsx       # NEW
├── ui/icon.tsx                  # NEW: fixed inline SVG set
└── logout-button.tsx            # unchanged, existing client leaf

lib/
├── nav/destinations.ts          # NEW: pure, role-filtered destination list
└── profile/identity.ts          # NEW: display name + initials for chrome

tailwind.config.ts               # EDIT: expose two existing sidebar tokens

tests/
├── unit/app-shell-nav.test.ts   # NEW
├── unit/app-shell.test.ts       # NEW
├── unit/a11y-lock.test.ts       # EDIT: add sidebar accent contrast pair
└── a11y/shell.test.ts           # NEW
```

**Structure Decision**: existing App Router layout, unchanged. Route groups `(auth)`, `(member)`, `(admin)` stay as they are — only the two authenticated layouts change, and each keeps its own redirect gate. Chrome lives under `components/shell/` because `AGENTS.md` reserves `components/` for presentational code, which is exactly what these are: they receive a destination list and an identity as props and make no decisions.

## Phase 0 — Research

Complete. See [research.md](./research.md). Thirteen decisions recorded, no unresolved unknowns. The three findings the spec appendix carried forward are settled there: icons become inline SVG (§1), the two missing sidebar theme keys get exposed (§8), and the mockup's `tap` spelling is dropped for the shipped `touch` spelling (§9).

## Phase 1 — Design & Contracts

Complete.

- [data-model.md](./data-model.md) — no persisted entities. Documents the two view models the shell consumes and the derivation rules that make them testable.
- [contracts/navigation.md](./contracts/navigation.md) — the destination list, role visibility rules, and current-section matching.
- [contracts/shell-chrome.md](./contracts/shell-chrome.md) — required structure, landmarks, and accessibility obligations of each chrome piece.
- [quickstart.md](./quickstart.md) — how to run and inspect the shell locally, including the mockup side-by-side.

## Post-Design Re-Check

Re-evaluated after Phase 1. No new violations.

- Design adds no persisted data, so Principle I's RLS obligations are unchanged and `pnpm test:rls` needs no new policy file.
- The identity read introduces one primary-key lookup per authenticated render inside `withRls` with the caller's own user id — no widened visibility.
- Rendering both navigation elements duplicates a small link list. Justified in [research.md](./research.md) §2 as the cost of avoiding a client component; the alternative would breach FR-020.
- FR-023's icons resolve without a dependency, so the Stack gate stays clean.

## Complexity Tracking

No constitution violations require justification. The table is intentionally empty.
