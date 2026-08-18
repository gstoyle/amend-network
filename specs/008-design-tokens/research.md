# Research: Design Tokens

**Feature**: `008-design-tokens` | **Date**: 2026-08-18

All Technical Context unknowns are resolved below. This is a polish slice: no schema, no new authorization, no new routes.

## 1. Token file lives in the app, copied from the mockup

**Decision**: Add `app/tokens.css` as the single brand token file (PRD §7 layer 1). Copy primitive + semantic values from `mockup/src/styles/tokens.css` (colors, type, space, radius, elevation, focus, motion). Import it from `app/globals.css`. Do **not** `@import` the mockup path at runtime (`mockup/` is excluded from the Next app).

A unit test asserts required custom properties and that `--primary` (light) equals the mockup `--evergreen-700` value so the copy cannot silently drift.

**Rationale**: Constitution V and the spec name `tokens.css`. The mockup is the current brand source (spec assumption). Shipping the mockup tree inside standalone output would couple production CSS to a Vite playground.

**Alternatives considered**:

- Import `mockup/src/styles/tokens.css` from Next — rejected; mockup is excluded and is not a production artefact.
- Keep tokens only inside `globals.css` — rejected; PRD §7 requires a swappable `tokens.css`.
- `tokens.json` + build script (PRD §7 layer 2) — out of scope until the WordPress brand team delivers.

## 2. Theme utilities read complete CSS colors, not HSL channels

**Decision**: Replace the current shadcn HSL-channel pattern (`--primary: 174 62% 24%` + `hsl(var(--primary))`) with the mockup pattern: token values are complete colors (`#1f4d3f`, `var(--evergreen-700)`, etc.) and `tailwind.config.ts` maps `background: "var(--background)"` (and the rest) the same way `mockup/tailwind.config.js` does.

Extend the existing theme with mockup semantics the app does not yet expose: `primary-hover`, `primary-subtle`, `support`, `success` / `warning` / `info`, `border-strong`, sidebar tokens, font size/weight/family, spacing (including `tap` / `gutter`), radius scale, shadows, and motion durations. Keep existing class names (`bg-primary`, `text-foreground`, `rounded-md`, `min-h-touch`) so pages inherit without rewrites.

**Rationale**: Mockup tokens are hex/rgb, not channel triplets. Wrapping them in `hsl()` would be invalid. Wiring the scale through Tailwind is the spec’s “without per-page rewrites” mechanism.

**Alternatives considered**:

- Convert every mockup hex to HSL channels — extra transform, easy to drift, unused by the mockup.
- Leave Tailwind on HSL and only change `:root` — utilities would not resolve.

## 3. Dark appearance is OS media, not a `.dark` class

**Decision**: In `tokens.css`, apply the mockup `:root.dark` semantic overrides inside `@media (prefers-color-scheme: dark)` on `:root`. Do not add `darkMode: "selector"`, an in-app toggle, or a `.dark` class on `<html>`. Semantic tokens swap; `dark:` variants are unnecessary.

**Rationale**: Spec FR-008. The app already uses a dark media query in `globals.css`. The mockup’s class-based dark is for a playground toggle this product does not have.

**Alternatives considered**:

- Copy `:root.dark` + Tailwind selector darkMode — implies a class we will not set.
- Drop dark mapping — would regress current OS dark behavior.

## 4. Geist is self-hosted via `next/font`

**Decision**: Load Geist and Geist Mono with `next/font/google` in `app/layout.tsx` (`variable: "--font-geist-sans"` / `"--font-geist-mono"`, `subsets: ["latin"]`, `display: "swap"`). Put those variables on `<html>`. In `tokens.css`, set `--font-body` / `--font-heading` / `--font-mono` to those variables plus system fallbacks. Do **not** copy the mockup’s runtime `@import` of `fonts.googleapis.com`.

`next/font` downloads at build time and serves from the origin; the browser does not request Google at runtime ([Next.js font docs](https://nextjs.org/docs/app/getting-started/fonts)).

**Rationale**: Mockup type families are Geist. Runtime Google Fonts would send member traffic to a third party (Constitution II spirit; shared-device users). No new npm package.

**Alternatives considered**:

- Mockup Google CSS `@import` — rejected; runtime third-party request.
- System-ui only — would not match the mockup type.

## 5. Shared chrome: class tokens only, no mockup shell

**Decision**: Restyle in place:

| Surface | Files | What changes |
| --- | --- | --- |
| Buttons / fields / labels | `components/ui/button.tsx`, `input.tsx`, `label.tsx` | Token hover (`primary-hover`), focus via `--ring` / `--focus-*`, keep `min-h-touch` |
| Native selects / textareas | Duplicated `fieldClassName` / `selectClassName` in forms | Reuse an exported `controlClassName` from `input.tsx` (same markup, shared classes) |
| Cards | New `components/ui/card.tsx` (class helper / thin host) applied on existing `<article>` hosts | `bg-card`, `border-border`, radius, shadow — **no extra wrapper if the host is already an article** |
| Nav / layout | `app/(member)/layout.tsx`, `app/(admin)/layout.tsx`, `app/layout.tsx` | Background, border, gutter padding, type on chrome only |
| Initials | `components/member-initials.tsx` | Already `bg-primary`; inherits new primary |

Do **not** port `PortalShell`, `DesktopSidebar`, or `BottomTabBar` from the mockup (spec: no structure / IA change).

**Rationale**: Spec forbids structure/behavior change. A shared card helper does not exist today (`resource-card` is page-specific); a presentational `ui/card` is the smallest reuse. Duplicated select strings are the same control family as Input.

**Alternatives considered**:

- Per-page class edits only — rejected; next brand change would need another pass.
- Copy mockup layout components — rejected; new structure.

## 6. Contrast and 44px are unit-tested; axe contrast stays off

**Decision**: Prove FR-006 with a **unit** contrast checker on token pairs in [contracts/contrast.md](./contracts/contrast.md) (light and dark). Keep existing `pnpm test:a11y` suites (axe `color-contrast` remains disabled in jsdom). Keep `min-h-touch` / `min-w-touch` mapped to `--tap-target` (`2.75rem`). Keep the existing `prefers-reduced-motion` rule in `globals.css`.

**Rationale**: Current a11y fixtures are HTML strings without computed CSS, so axe cannot prove token contrast. Constitution V still requires a measurable proof.

**Alternatives considered**:

- Enable axe `color-contrast` in jsdom — unreliable without full stylesheet application.
- Playwright visual snapshots — extra runner; not required this slice.

## 7. No new libraries; no schema; no permission delta

**Decision**: No new npm dependencies. No Prisma/migrations. Permission matrix unchanged; `pnpm test` and `pnpm test:rls` are regression gates. Fail-first work is token/theme/shared-chrome tests, not RLS.

**Rationale**: Spec FR-005 / FR-010. YAGNI.

**Alternatives considered**: None in scope.
