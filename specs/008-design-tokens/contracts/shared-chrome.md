# Contract: Shared chrome (in-scope restyle)

Structure, roles, labels, and handlers MUST NOT change. Class names and token-backed utilities MAY change.

## In scope

| Kind | Path | Styling intent |
| --- | --- | --- |
| Token file | `app/tokens.css` | **New.** Copy of mockup token set |
| Global CSS | `app/globals.css` | Import tokens; body uses `--background` / `--foreground` / `--font-body`; drop HSL wrappers; keep reduced-motion |
| Theme | `tailwind.config.ts` | [theme-mapping.md](./theme-mapping.md) |
| Root layout | `app/layout.tsx` | Geist CSS variables on `<html>`; no Google `<link>` |
| Member chrome | `app/(member)/layout.tsx` | Nav/header/main: background, border, gutter, type tokens |
| Admin chrome | `app/(admin)/layout.tsx` | Same token set as member (one brand) |
| Button | `components/ui/button.tsx` | Variants stay; add token hover/focus; keep `min-h-touch` |
| Input | `components/ui/input.tsx` | Token border/radius/focus; export `controlClassName` for native select/textarea duplicates |
| Label | `components/ui/label.tsx` | Token type/color |
| Card | `components/ui/card.tsx` | **New** presentational class helper; apply on existing article hosts |
| Resource card | `components/resource-card.tsx` | Card tokens on existing `<article>` |
| Announcement chrome | `components/announcement-banners.tsx` | Card/border tokens on existing `<article>` |
| Initials | `components/member-initials.tsx` | Inherits `bg-primary` (brand color default) |
| Form duplicates | `fieldClassName` / `selectClassName` in 002–007 forms | Point at `controlClassName` — markup unchanged |

## Out of scope (do not port)

- `mockup/src/components/layout/PortalShell.tsx`
- `DesktopSidebar.tsx`, `BottomTabBar.tsx`, `MobileTopBar.tsx`
- Per-page mockup layouts (`Login.tsx`, `Resources.tsx`, …)
- New routes, new client trees, forum (not built)

## Forbidden on in-scope files

Hex, `rgb()`, `hsl()`, or pixel literals for color / font / radius / spacing on `components/ui/*` and the two route-group layouts. Tailwind utilities that resolve to tokens are required.

## Behavior lock

`pnpm test` and `pnpm test:rls` MUST remain green. No Prisma changes. No `requireRole` / RLS edits.
