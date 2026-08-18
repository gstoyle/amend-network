# Quickstart: Admin Analytics (local)

Proves this slice against **local** Postgres 16. No DreamHost. Analytics `track()` is **not** called for these screens.

## Prerequisites

Same as [../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm, Docker Postgres, `.env` from `.env.example`. Seed password = `SEED_PASSWORD`.

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
```

Seed still includes the eight auth users plus prior content fixtures. This slice adds **no** new seed tables. Tests insert extra invitations, logins, downloads, and RSVPs as needed.

## Automated validation

```bash
pnpm test          # includes app matrix; requireRole not mocked
pnpm test:rls      # includes tests/rls/admin-analytics-snapshot.test.ts
pnpm test:a11y     # axe on /admin, /admin/analytics, /admin/audit-log
pnpm typecheck
pnpm lint
```

Expect: **View analytics dashboard** allow for Super Admin and Admin, deny for Moderator and members ([permission-matrix.md](./contracts/permission-matrix.md)); remaining unbuilt rows fail-closed; Admin snapshot JSON matches Super Admin; Admin `SELECT audit_log` still 0 rows older than 90 days; viewer writes `audit_log_viewed`; Super Admin CSV writes `audit_log_exported`; Admin export denied with 0 export rows; withdrawn resources / cancelled events omitted from leaderboards; resources/events with count < 3 omitted entirely (not listed); each leaderboard ≤ 10; 0 forum ranks; `admin-analytics-snapshot.test.ts` Direct EXECUTE cases in [rls-policies.md](./contracts/rls-policies.md) pass.

## Manual validation (optional)

```bash
pnpm dev
```

Sign in as seeded Super Admin (complete MFA). Then:

| Check | Expect |
| --- | --- |
| `/admin` | Four KPI cards + existing staff links |
| `/admin/analytics` | Same cards, funnel, resource + event leaderboards, no flags/threads |
| Funnel `network` = Pathways vs LEAD | Stage counts change; other network disappears |
| `/admin/audit-log` filters | Actor, action, dates, severity combine; pagination works |
| Export CSV | File downloads; new `audit_log_exported` row; no names/emails |
| Seeded Admin | Same KPI/funnel numbers; audit list last 90 days only; **no** export control |
| Seeded Moderator | `/admin` without KPI cards; `/admin/analytics` denied |
| Pathways member | Both analytics and audit-log denied |

## Contracts

- [analytics-http.md](./contracts/analytics-http.md)
- [audit-http.md](./contracts/audit-http.md)
- [rls-policies.md](./contracts/rls-policies.md)
- [audit-events.md](./contracts/audit-events.md)
- [permission-matrix.md](./contracts/permission-matrix.md)
- [data-model.md](./data-model.md)
