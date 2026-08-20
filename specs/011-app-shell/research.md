# Research: Authenticated App Shell

**Feature**: `011-app-shell` | **Date**: 2026-08-18

Every Technical Context unknown is resolved below. Tokens come from `008`. Session claims, `requireRole`, and `withRls` come from `002`. The mockup in `/mockup` is the structural source, as it was the token source for `008`.

## 1. Icon set — inline SVG, no runtime dependency

**Decision**: Add a single `components/ui/icon.tsx` exporting the small fixed set of glyphs the shell needs (home, resources, events, directory, account, sign out, and a shield for the privacy notice) as inline SVG server components. No package is installed.

**Rationale**: FR-023 requires a visual marker per navigation entry. The mockup gets that from `lucide-react`, but the shell needs roughly six fixed glyphs that never change at runtime. Constitution "Stack and Security Constraints" says do not add a library the constitution and active spec do not require, and Principle V holds the authenticated shell to a 180 KB gzip budget. Inline SVG costs nothing at install time, ships only the paths actually used, and needs no `use client`. Lucide is ISC-licensed, so its path data may be reused with attribution; the attribution belongs in `components/ui/icon.tsx`.

**Alternatives considered**:

- `lucide-react` — matches the mockup exactly and is tree-shakeable, but installs a dependency to render six static shapes. Rejected on YAGNI.
- No icons, labels only — cheapest, but bottom navigation labels at `--text-xs` are hard to scan, which is the reason the mockup uses icons at all. Rejected against FR-023.

## 2. Two navigation elements, CSS-toggled, exactly one exposed

**Decision**: Render the desktop sidebar and the mobile bottom bar in the same tree, toggled with `lg:flex` / `lg:hidden` exactly as the mockup does. Both keep `aria-label="Primary"`.

**Rationale**: `display: none` removes a subtree from the accessibility tree, so at any viewport exactly one navigation landmark named "Primary" is exposed. That avoids the duplicate-landmark problem without JavaScript, without a resize listener, and without a hydration boundary. Duplicated markup is a handful of links.

**Alternatives considered**:

- One navigation element restyled by media query — fewer nodes, but the sidebar and bottom bar have genuinely different internal structure (identity block, footer notice) and collapsing them produces worse markup than duplicating a link list.
- Client-side viewport detection — needs `use client` on the shell, breaks FR-020, and costs budget. Rejected.

## 3. Breakpoint stays `lg` (1024px)

**Decision**: Sidebar at `lg` and above; top bar plus bottom bar below `lg`. This is the mockup's own breakpoint (`lg:pl-64`, `lg:hidden`, `lg:flex`).

**Rationale**: Matching the mockup avoids inventing a breakpoint, and a 256px fixed sidebar plus `--content-max` needs roughly 1024px before it stops squeezing content. Tablets in portrait get the bottom bar, which is the correct thumb-reach behavior.

## 4. Current section from the `x-pathname` header

**Decision**: Read the current path with `headers().get("x-pathname")`, already set by `middleware.ts` for `/app` and `/admin`. Mark an entry current when the path equals its href, or begins with its href followed by `/`. The home entry (`/app`) matches exactly, never by prefix.

**Rationale**: The member layout already uses this header for the pending redirect, so no new mechanism is introduced. Prefix matching gives FR-004's requirement that a detail page marks its parent section. Exact-matching home prevents `/app` from claiming every page.

**Alternatives considered**:

- `usePathname()` — requires `use client` on the shell. Rejected against FR-020 and the budget.

## 5. Navigation definition lives in `lib/`, not `components/`

**Decision**: New `lib/nav/destinations.ts` exports a pure `memberDestinations(claims)` / `adminDestinations(claims)` returning label, href, icon key, and match rule. Components receive the resulting list as props.

**Rationale**: `AGENTS.md` is explicit that `components/` is presentational with no role logic, and Principle I requires role decisions to come from the signed session on the server. A pure function taking `SessionClaims` is directly unit-testable without mocking `requireRole`, which Principle IV requires.

**Why a new file**: no existing helper owns navigation. `lib/auth/requireRole.ts` decides access, not presentation, and folding a destination list into it would blur enforcement with chrome.

## 6. Chrome identity read is narrow and separate from session claims

**Decision**: New `lib/profile/identity.ts` exports `loadShellIdentity(session)`, returning display name and initials only, through `withRls` with the caller's own user id.

**Rationale**: FR-018 limits persistent chrome to display name and program role. The program role is already on `SessionClaims`; the name is not, and is encrypted at rest.

**Why not extend `loadSession`**: it already reads the user row, so adding a decrypted name there would cost no extra query — but it would put PII on `SessionClaims`, the type every authorization path carries and every test fixture constructs. Widening an authorization artifact to hold PII is the wrong trade under Principle II, and it would churn the session fixtures behind 416 tests.

**Why not extend `loadDirectoryPrivacy`**: that returns a privacy-form view model, does not select the name column, and is not called by most pages. Coupling chrome to it would make every page pay for a directory-privacy read.

**Cost**: one indexed primary-key lookup per authenticated render.

## 7. Admin chrome shares the shell; route groups stay separate

**Decision**: Extract `components/app-shell.tsx` (presentational, props-only) and use it from both `app/(member)/layout.tsx` and `app/(admin)/layout.tsx`. For a session with an administrative role, administrative destinations render as a second labelled group inside the same sidebar, and member destinations remain present on administrative pages.

**Rationale**: PRD §B.5 requires admins never choose between a member view and an admin view. Sharing the component satisfies that without merging route groups, so the existing MFA redirect in the admin layout and the pending redirect in the member layout each stay where they are.

**Alternatives considered**:

- Merge `(admin)` into `(member)` — would move the MFA gate and risk Principle I regressions for a purely visual gain. Rejected.
- Separate admin sidebar component — reproduces the second-skin outcome PRD §B.5 rules out. Rejected.

## 8. Two theme keys are missing and must be exposed

**Decision**: Add `sidebar.accent-foreground` and `sidebar.primary-foreground` to the `sidebar` colour group in `tailwind.config.ts`.

**Rationale**: `app/tokens.css` already defines `--sidebar-accent-foreground` and `--sidebar-primary-foreground` in both light and dark blocks — `008` extracted the full set. The Tailwind theme exposes only six of the eight, so the mockup's active-item class `text-sidebar-accent-foreground` currently resolves to nothing. FR-017 covers this: the value exists, so exposing it is wiring, not a new token.

## 9. Tap-target utilities use the shipped spelling

**Decision**: Use `min-h-touch` / `min-w-touch`. Do not introduce `min-h-tap` / `h-tap` / `w-tap` from the mockup.

**Rationale**: Both resolve to `--tap-target`, but the codebase standardized on `touch` and `tests/unit/shared-chrome.test.ts` asserts those strings. A second spelling for one value is exactly the divergence the spec's naming assumption rules out.

## 10. Safe area is a device value, not a design token

**Decision**: The bottom bar carries `padding-bottom: env(safe-area-inset-bottom)`. Main content clears the bar with token spacing (`pb-24`, `lg:pb-16`), matching the mockup.

**Rationale**: FR-015 requires targets to stay tappable above a reserved bottom edge. `env(safe-area-inset-bottom)` reports a device measurement; it is not a design value and cannot come from the token set, so it does not violate FR-017. The clearance that *is* a design value uses tokens.

## 11. Restricted-status sessions get a minimal frame

**Decision**: On `/app/pending`, render the shell with the brand block, the identity block, and sign out — no primary destinations.

**Rationale**: FR-019 forbids offering destinations that immediately redirect. The member layout already redirects pending sessions to the holding page, so a full navigation list there would be a list of bounces.

## 12. Testing approach

**Decision**: Three new files, all written before the shell exists, per Principle IV.

| File | Proves |
| --- | --- |
| `tests/unit/app-shell-nav.test.ts` | `memberDestinations` / `adminDestinations` are role-correct: no administrative destination for a member or pending session; a browser-supplied role changes nothing; current-section matching including the home exact-match case |
| `tests/unit/app-shell.test.ts` | Source-level token discipline on shell components, same shape as `tests/unit/shared-chrome.test.ts`: no hex, `rgb(`, `hsl(`, or `px` literals; `min-h-touch` present; landmarks present |
| `tests/a11y/shell.test.ts` | axe-core over rendered shell markup for member and admin cases: landmark structure, skip link before navigation, `aria-current` on the active entry, no violations |

`pnpm test:rls` is unchanged — this slice touches no query, policy, or role check. It still runs as a regression gate because FR-010 and SC-007 assert authorization outcomes are identical.

**Contrast**: the existing a11y harness disables axe's `color-contrast` rule because jsdom cannot compute it, and `tests/unit/a11y-lock.test.ts` checks token pairs numerically instead. Shell colours reuse pairs that lock already covers (`sidebar` / `sidebar-foreground`, `primary` / `primary-foreground`). Extend the lock with the sidebar accent pair rather than trusting axe here.

## 13. No new dependency, no client component, no data

**Decision**: The shell adds no package, no `use client`, no table, no column, no audit action, and no analytics event. `components/logout-button.tsx` is already a client leaf and stays the only one in the chrome.

**Rationale**: FR-021 and Principle V's server-component default. Links plus CSS need no interactivity, which is also what makes FR-020 achievable.

## 14. Resource cards keep the authenticated thumbnail; the format tile is the fallback

**Decision**: Do not replace the resource card `<img>` with a format-only glyph. The mockup shows a format tile because its fixtures have no uploaded images. `004-resource-library` requires the card to show the thumbnail through the authenticated grant handler (`GET /app/resources/[id]/thumbnail`), and the data model makes a thumbnail required at publish. Implemented treatment: the format tile occupies the mockup's position, size, and caption; the thumbnail is layered over the glyph so the glyph is what remains if the grant 404s.

**Rationale**: A future chrome or layout slice that "matches the mockup" by deleting `<img>` would regress 004 (required preview, short-lived access, no durable storage URL in the page). The `tests/unit/shared-chrome.test.ts` `<img>` assertion is load-bearing. Recorded here so 011 follow-up work does not treat the mockup glyph as the product rule.

**Alternatives considered**: drop the thumbnail to match the mockup pixel-for-pixel — rejected against 004. Keep both as sibling elements — two competing treatments on one card.
