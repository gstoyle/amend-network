# Quickstart: Member Directory (local)

Proves this slice against **local** Postgres 16. No DreamHost. No object storage. Analytics `track()` no-ops unless `POSTHOG_KEY` is set.

## Prerequisites

Same as [../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm, Docker Postgres, `.env` from `.env.example`. Optional: `POSTHOG_KEY` (unset → analytics no-op).

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
```

Seed still includes the eight auth users plus prior content fixtures. New: opted-in / opted-out Pathways and LEAD members with mixed field toggles (title on / DOC off, etc.). Password = `SEED_PASSWORD`.

## Automated validation

```bash
pnpm test          # includes app matrix; requireRole not mocked
pnpm test:rls      # listings / shown-fields / throttle as amend_app; includes tests/rls/directory-listing-visible.test.ts
pnpm test:a11y     # axe on /app/directory* and /app/profile/privacy
pnpm typecheck
pnpm lint
```

Expect: directory capabilities **allow/deny** per [permission-matrix.md](./contracts/permission-matrix.md); remaining rows fail-closed; Pathways sees 0 LEAD listings; hidden DOC search returns 0 hits for that member; staff see both programs but not hidden fields; `directory-listing-visible.test.ts` passes Direct EXECUTE cases in [rls-policies.md](./contracts/rls-policies.md); Pathways `SELECT` on other `users` rows is 0; successful privacy save writes exactly one `directory_privacy_changed`; other-member profile view writes `directory_profile_viewed` with no PII in metadata.

## Manual validation (optional)

```bash
pnpm dev
```

| Check | Expect |
| --- | --- |
| New Active member, never saved privacy | Not in anyone’s results; prompt on home and directory |
| Pathways opts in, title on, DOC/email off | Same-program peer sees name, network, title; no DOC/email |
| Peer searches hidden DOC label | 0 hits for that member (not a blanked row) |
| Peer searches visible name | Hit; DOC omitted |
| LEAD opens directory | 0 Pathways listings |
| Admin `/app/directory` | Opted-in Pathways **and** LEAD; hidden fields still omitted |
| Pending `/app/pending` | Holding page; 0 directory |
| Guess LEAD id as Pathways | Not-found withholding |
| 31st search in a minute | Try later; no list |
| Opt out | Disappears immediately |

## Contracts

- [directory-http.md](./contracts/directory-http.md)
- [rls-policies.md](./contracts/rls-policies.md)
- [audit-events.md](./contracts/audit-events.md)
- [permission-matrix.md](./contracts/permission-matrix.md)
- [data-model.md](./data-model.md)
