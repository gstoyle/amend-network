# Contract — shell chrome

Structural and accessibility obligations of each chrome piece. Visual structure is ported from `/mockup`; every value resolves through the `008` token set.

All four components are **presentational**: props in, markup out. No data fetching, no role logic, no `use client`. The only client leaf in the chrome is the existing `components/logout-button.tsx`.

## `AppShell`

Composes the chrome and wraps page content.

Required structure, in DOM order:

1. Skip link — first focusable element, before any navigation (FR-011). Visually hidden until focused.
2. `DesktopSidebar` — `hidden lg:flex`
3. `MobileTopBar` — `lg:hidden`
4. `<main id="main-content">` inside a container offset for the sidebar (`lg:pl-64`), bounded by `max-w-content`, with gutter padding and bottom clearance for the tab bar (`pb-24 lg:pb-16`)
5. `BottomTabBar` — `lg:hidden`

Exactly one navigation landmark is in the accessibility tree at any viewport, because the other is `display: none` ([../research.md](../research.md) §2).

The page's `<h1>` stays inside `main`. The shell MUST NOT introduce an `<h1>`, or heading order breaks on all 33 pages.

## `DesktopSidebar`

Fixed, 256px, full height, `bg-sidebar` with a right border.

| Region | Contents |
| --- | --- |
| Brand | Product name linking to `/app`, with a quiet subtitle |
| Identity | Display name, program role, from `ShellIdentity` (FR-018) |
| Primary | `<nav aria-label="Primary">` — member destinations; administrative group follows in its own labelled `<nav>` when present |
| Footer | Shared-device privacy notice, then sign out |

- Entries are `<a>` inside `<li>` inside `<ul>`. A list is marked up as a list.
- Current entry: `aria-current="page"`, `bg-sidebar-accent text-sidebar-accent-foreground`, and a non-colour marker.
- Every entry ≥ 44×44 via `min-h-touch`.
- The mockup's placeholder brand string is not carried over.

## `MobileTopBar`

Sticky, below `lg`, `bg-card` with a bottom border.

- Brand block linking to `/app`.
- Account control opening the account destinations, labelled with an accessible name that includes the person's name.
- Initials avatar is `aria-hidden`; the accessible name comes from the control's label, not the glyph.
- Controls ≥ 44×44.
- The mockup's search shortcut is included only if it points at an existing search screen; otherwise omitted.

## `BottomTabBar`

Fixed to the bottom, below `lg`, `bg-card`, top border, `shadow-bar`.

- `<nav aria-label="Primary">` wrapping a `<ul>` of equal-width items.
- Each item stacks an active indicator, an icon, and a **text label**. The label is never removed (FR-023).
- Current entry: `aria-current="page"`, `text-primary`, plus the visible indicator bar — two signals, not colour alone.
- `padding-bottom: env(safe-area-inset-bottom)` so targets clear a reserved bottom edge (FR-015).
- Each item ≥ 44×44.
- Member destinations only. No administrative destination ever appears here.

## `Icon`

Fixed inline SVG set: home, resources, events, directory, account, sign out, shield.

- `aria-hidden="true"` and `focusable="false"`. Icons are decorative; the label carries meaning (FR-023).
- `currentColor` for stroke or fill, so colour comes from the parent's token class.
- Sized with token spacing. No `px` literals.
- Path data derived from Lucide (ISC). Attribution belongs in the file header.

## Cross-cutting

**Tokens** — no hex, `rgb(`, `hsl(`, or `px` literal in any chrome file. `tests/unit/app-shell.test.ts` enforces this with the same regex `tests/unit/shared-chrome.test.ts` uses. The one permitted non-token value is `env(safe-area-inset-bottom)`, a device measurement ([../research.md](../research.md) §10).

**Tap targets** — `min-h-touch` / `min-w-touch`. Never the mockup's `min-h-tap` ([../research.md](../research.md) §9).

**Motion** — transitions use `duration-fast` and `ease-standard`. The global `prefers-reduced-motion` block in `app/globals.css` already neutralizes them; no motion may be required to operate navigation (FR-016).

**Restricted status** — for `status = pending`, the shell renders brand, identity, and sign out only (FR-019).

**Theme keys** — `tailwind.config.ts` must expose `sidebar.accent-foreground` and `sidebar.primary-foreground`. Both custom properties already exist in `app/tokens.css`; only the theme mapping is missing ([../research.md](../research.md) §8).

**Contrast** — the jsdom a11y harness disables axe's colour-contrast rule, so the sidebar accent pair is added to `tests/unit/a11y-lock.test.ts` and checked numerically in both light and dark values instead.
