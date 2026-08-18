# Quickstart: Design Tokens (local)

Proves this polish slice on the local app. No database migration. No DreamHost.

## Prerequisites

Same as [../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm. Docker Postgres only if you also run the regression suites that need a DB (`pnpm test`, `pnpm test:rls`).

## Setup

```bash
pnpm install
```

Optional, for permission regression:

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
```

## Automated validation

```bash
pnpm test                 # includes tests/unit/design-tokens.test.ts; existing matrix unchanged
pnpm test:rls             # regression only — no new policies
pnpm test:a11y            # existing page fixtures; landmarks/labels
pnpm typecheck
pnpm lint
```

Expect: [token-manifest.md](./contracts/token-manifest.md) properties present; `--primary` / `--background` match mockup evergreen/stone; [contrast.md](./contracts/contrast.md) pairs pass light and dark; theme mapping uses `var(--*)`; `components/ui` has no hard-coded colors; permission and RLS suites still green.

## Manual validation (optional)

```bash
pnpm dev
```

| Check | Expect |
| --- | --- |
| `/login` | Warm stone page, evergreen primary button, mockup radii — not the old teal placeholder |
| Signed-in member shell | Nav + cards (resources, announcements, directory initials) use the same token set |
| Admin chrome | Same brand as member (not a second skin) |
| Change `--primary` in `app/tokens.css`, refresh | Shared primary buttons update on login and member shell without editing those pages |
| OS dark appearance | Semantic surfaces follow mockup dark values; no in-app toggle |
| 360px width | No horizontal scroll on login / member nav; controls still ≥ 44×44 |

## Contracts

- [token-manifest.md](./contracts/token-manifest.md)
- [theme-mapping.md](./contracts/theme-mapping.md)
- [shared-chrome.md](./contracts/shared-chrome.md)
- [contrast.md](./contracts/contrast.md)
- [data-model.md](./data-model.md)
- [research.md](./research.md)
