# Implementation Plan: Design Tokens

**Branch**: `008-design-tokens` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-design-tokens/spec.md`

## Summary

Infrastructure/polish (not a PRD product slice): adopt the mockup’s “Quiet Institution” visual language as the platform brand token set so slices 002–007 inherit Amend look without per-page rewrites.

Technical approach: copy `mockup/src/styles/tokens.css` into `app/tokens.css`; point `tailwind.config.ts` at complete CSS variables (drop HSL-channel placeholders); self-host Geist via `next/font/google`; restyle shared buttons, fields, cards, nav, and layout chrome in place. **No** structure/behavior change, **no** schema, **no** new routes, **no** `tokens.json` pipeline, **no** mockup shell/IA.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, standalone), Tailwind CSS 3, existing shadcn-style `components/ui`, `next/font/google` (Geist). **No new npm libraries.**

**Storage**: N/A (no database or object-storage change)

**Testing**: Vitest unit for token manifest, theme mapping, contrast pairs, and no hard-coded appearance on shared UI. Regression: `pnpm test`, `pnpm test:rls`, `pnpm test:a11y`. Dedicated fail-first file `tests/unit/design-tokens.test.ts` — see Required standalone tasks below.

**Target Platform**: Local developer machine. **No** DreamHost dependency.

**Project Type**: Single Next.js full-stack app at repository root (AGENTS.md).

**Performance Goals**: Authenticated shell JS ≤ 180 KB gzip (no new `'use client'` trees). Fonts self-hosted (build-time download; no runtime Google request).

**Constraints**: Constitution V (tokens only; 4.5:1 / 3:1 / 44×44 / reduced motion); look-only (FR-005); existing permission proofs stay green; env-only hostnames (none new); no third-party font CDN at runtime.

**Scale/Scope**: Token file + theme + shared chrome from 002–007 (buttons, fields, cards, nav, layout). Not a WordPress brand-manifest pipeline. Not a mockup layout port.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | No new data paths; no `requireRole` / RLS edits | Pass |
| II. Privacy and audit | No PII, analytics, or audit changes; fonts self-hosted (no runtime Google) | Pass |
| III. Self-operated infra | No new host services; tokens are static CSS | Pass |
| IV. Test-first permission proof | No new matrix rows; regression `pnpm test` + `pnpm test:rls`; new fail-first token/contrast file | Pass |
| V. Accessible, token-driven UI | This slice **is** Principle V: `tokens.css`, theme wiring, shared chrome, contrast + 44px proofs | Pass |
| Stack | Tailwind + CSS custom properties; no new framework | Pass |
| YAGNI | No `tokens.json` script, no theme switcher, no PortalShell / bottom bar, no per-page mockup clones | Pass |

No unjustified violations. Complexity Tracking remains empty.

`components/ui/card.tsx` is **new** because no shared card helper exists (research §5). Input **does** extend `controlClassName` rather than a new Select primitive. Analytics/auth/DB **unchanged**.

### Post-design (pass)

Phase 1 copies mockup tokens into `app/tokens.css`, maps Tailwind to `var(--*)`, applies OS dark via media query (not `.dark`), self-hosts Geist, restyles shared chrome in place, and proves contrast in unit tests (axe contrast stays off in jsdom). Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/008-design-tokens/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md              # created by /speckit-tasks, not this command
```

### Source Code (repository root)

```text
app/
├── tokens.css                               # NEW: mockup token copy
├── globals.css                              # EXTEND: import tokens; drop HSL wrappers
├── layout.tsx                               # EXTEND: Geist CSS variables on <html>
├── (member)/layout.tsx                      # EXTEND: chrome classes only
└── (admin)/layout.tsx                       # EXTEND: chrome classes only
components/ui/
├── button.tsx                               # EXTEND: token hover/focus
├── input.tsx                                # EXTEND: export controlClassName
├── label.tsx                                # EXTEND: token type
└── card.tsx                                 # NEW: presentational card classes
components/
├── resource-card.tsx                        # EXTEND: card tokens on existing article
├── announcement-banners.tsx                 # EXTEND: card tokens on existing article
└── member-initials.tsx                      # inherits primary
tailwind.config.ts                           # EXTEND: var(--*) mapping
tests/unit/design-tokens.test.ts             # REQUIRED standalone; fail-first
```

**Structure Decision**: Same single Next.js app. No new route groups. Shared chrome stays in `components/ui` and the two layouts. Do not add `lib/design/` unless a contrast helper is needed by the unit test (colocate in the test file first).

## Required standalone tasks (`/speckit-tasks`)

`/speckit-tasks` MUST emit the following as **its own task ID**, fail-first, with this file path. Do **not** fold it into a generic “update CSS” item.

- Write failing tests in `tests/unit/design-tokens.test.ts` that (1) `app/tokens.css` defines every custom property in [contracts/token-manifest.md](./contracts/token-manifest.md); (2) light `--primary` is mockup `--evergreen-700` (`#1f4d3f`) and light `--background` is `--stone-100` (`#f4f1eb`); (3) contrast pairs in [contracts/contrast.md](./contracts/contrast.md) meet the stated ratios in light and dark; (4) `tailwind.config.ts` maps listed colors to `var(--*)` and does **not** wrap them in `hsl()`; (5) `components/ui/*.tsx` contain no hex / `rgb(` / `hsl(` literals. Assert the cases in those contracts.

## Complexity Tracking

> No constitution violations to justify.
