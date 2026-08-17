# Quickstart: Event Calendar (local)

Proves this slice against **local** Postgres 16. No DreamHost. No object storage. Analytics `track()` no-ops unless `POSTHOG_KEY` is set. Mail uses the existing transport (file/outbox in local env; Postmark only if configured).

## Prerequisites

Same as [../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm, Docker Postgres, `.env` from `.env.example`. Optional: `POSTHOG_KEY` (unset → analytics no-op).

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
```

Seed still includes the eight auth users plus resource and announcement fixtures. New: shared / Pathways / LEAD / both events, one cancelled, virtual events inside and outside the reveal window, and a capacity=1 event. Password = `SEED_PASSWORD`.

## Automated validation

```bash
pnpm test          # includes app matrix; requireRole not mocked
pnpm test:rls      # events / rsvps / join-links as amend_app; includes tests/rls/event-promote-oldest-waitlist.test.ts
pnpm test:a11y     # axe on /app/events* and /admin/events*
pnpm typecheck
pnpm lint
```

Reminder pass (frozen clock in tests; locally):

```bash
# Implementation will export runEventReminders(now); tests inject now.
# Do not require a host crontab. Example once the helper exists:
pnpm exec tsx -e "require('./lib/events/reminders.ts')"  # exact CLI lands in tasks.md
```

Expect: event capabilities **allow/deny** per [permission-matrix.md](./contracts/permission-matrix.md); remaining rows fail-closed; Pathways sees 0 LEAD-only events; Yes at capacity=1 waitlists the second user; `event-promote-oldest-waitlist.test.ts` passes the three direct-`EXECUTE` cases in [rls-policies.md](./contracts/rls-policies.md); join URL absent until `[start − 1h, end]` for Yes; successful create writes exactly one `event_created`; ICS 401/withhold without session or visibility.

## Manual validation (optional)

```bash
pnpm dev
```

| Check | Expect |
| --- | --- |
| Pathways `/app/events` | Shared + Pathways uncancelled; no LEAD-only; no cancelled |
| LEAD same | Shared + LEAD; no Pathways-only |
| Pending `/app/pending` | Holding page; 0 events |
| Moderator `/admin/events/new` | Can create (MFA); cannot create announcements |
| RSVP Yes at capacity 1, second user Yes | Second is waitlisted; first No → second promoted + invite |
| Virtual event >1h before start, Yes | Detail and ICS omit join URL |
| Same event inside window, Yes | Join URL on detail; ICS may include it |
| Maybe inside window | No join URL |
| Guess LEAD-only id as Pathways (RSVP/ICS) | Not-found withholding |
| Admin/Moderator cancel | Disappears for members; still listed cancelled for staff; RSVPs mailed |
| Shrink capacity below current Yes | Existing Yes stay; warn; new Yes waitlist |

## Contracts

- [event-http.md](./contracts/event-http.md)
- [rls-policies.md](./contracts/rls-policies.md)
- [audit-events.md](./contracts/audit-events.md)
- [permission-matrix.md](./contracts/permission-matrix.md)
- [data-model.md](./data-model.md)
