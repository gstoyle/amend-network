# Quickstart: Announcement Banners (local)

Proves this slice against **local** Postgres 16. No DreamHost. No object storage. Analytics `track()` no-ops unless `POSTHOG_KEY` is set; uniqueness is still asserted via the impression/click tables.

## Prerequisites

Same as [../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm, Docker Postgres, `.env` from `.env.example`. Optional: `POSTHOG_KEY` (unset → analytics no-op).

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
```

Seed still includes the eight auth users and resource fixtures. New: live shared / Pathways / LEAD / both banners, plus scheduled, expired, and withdrawn rows, with staggered `activates_at` for the cap-of-two case. Password = `SEED_PASSWORD`.

## Automated validation

```bash
pnpm test          # includes app matrix; requireRole not mocked
pnpm test:rls      # announcements SELECT/INSERT/UPDATE and dismissals as amend_app
pnpm test:a11y     # axe on member chrome and /admin/announcements*
pnpm typecheck
pnpm lint
```

Expect: announcement capabilities **allow/deny** per [permission-matrix.md](./contracts/permission-matrix.md); remaining rows fail-closed; Pathways sees 0 LEAD-only live banners; three eligible Pathways banners yield the most recently activated two; successful create writes exactly one `announcement_created`; repeat show does not add a second impression row.

## Manual validation (optional)

```bash
pnpm dev
```

| Check | Expect |
| --- | --- |
| Pathways `/app` (and `/app/resources`) | Shared + Pathways live in-window banners, at most two, most recently activated |
| LEAD same | Shared + LEAD; no Pathways-only |
| Pending `/app/pending` | Holding page; 0 banners |
| Moderator member pages | All live in-window visibilities; admin create URLs denied |
| Dismiss a dismissible banner | Gone after reload for that user; still visible to another Pathways user |
| Three eligible banners | Only the two latest `activates_at` |
| Guess LEAD-only id as Pathways (dismiss/CTA) | Not-found withholding |
| Admin MFA → `/admin/announcements/new` | Create with past `activates_at` → live immediately for eligible members |
| `expires_at` before `activates_at` | Rejected; no row |
| Withdraw | Disappears for members; still listed as withdrawn for Admin |
| Queue filter scheduled / active / expired | Derived from the clock; no job required |

## Contracts

- [announcement-http.md](./contracts/announcement-http.md)
- [rls-policies.md](./contracts/rls-policies.md)
- [audit-events.md](./contracts/audit-events.md)
- [permission-matrix.md](./contracts/permission-matrix.md)
- [data-model.md](./data-model.md)
