# Implementation Plan: Event Calendar

**Branch**: `006-event-calendar` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-event-calendar/spec.md`

## Summary

Deliver PRD §5.3 on top of `002-auth-rbac` / `004-resource-library` / `005-announcements`: the third product content table using visibility `all_authenticated | pathways | lead`. Staff (Admin, Super Admin, **Moderator**) create events. Members get month/list calendar, RSVP Yes/No/Maybe with optional capacity and waitlist, calendar-file download, Yes invite + 24h reminder mail, and virtual join links only for Yes RSVPs inside `[start − 1 hour, end]`.

Technical approach: reuse `requireRole`, `withRls`, `app_role_tokens()`, audit writer, analytics `track()`, and `lib/email/transport.ts`. Add `events` + `event_rsvps` + `event_join_links` with native RLS. One SQL function `event_visible_core(uuid)` for not-cancelled + visibility intersection. Join URLs live on a **separate table** so member SELECT of `events` cannot leak them. ICS is an in-process text builder (no new npm package). Reminder pass is `runEventReminders(now)` like the invitation sweep — production crontab out of scope. No DreamHost. No second authorization model.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, standalone), Auth.js v5, Prisma 6, Tailwind + shadcn/ui tokens, Zod. **No new libraries** (ICS is RFC 5545 text in-process; mail and analytics helpers already exist).

**Storage**: PostgreSQL 16 (local Docker, `amend_app` FORCE RLS). No object storage in this slice.

**Testing**: Vitest unit + integration + app permission matrix. `pnpm test:rls` for events / RSVPs / join links. Dedicated fail-first file `tests/rls/event-promote-oldest-waitlist.test.ts` (direct `EXECUTE`, not via the RSVP helper) — see Required standalone tasks below. `pnpm test:a11y` on calendar, detail, admin pages. Reminder tests inject frozen `now`.

**Target Platform**: Local developer machine. **No** DreamHost dependency.

**Project Type**: Single Next.js full-stack app at repository root (AGENTS.md).

**Performance Goals**: Authenticated shell JS ≤ 180 KB gzip (`use client` only on month/list toggle and RSVP leaf). Admin create a complete event in < 3 minutes (SC-001). Calendar list is visibility-filtered, not a full-table dump to the client.

**Constraints**: Three authorization layers; `requireRole` never mocked in role tests; no client-supplied roles; same visibility vocabulary; virtual URL never on the member `events` SELECT; unique RSVP row per user+event; waitlist FIFO promotion in the same transaction as the Yes-seat free; audit append-only same transaction as create/edit/cancel/RSVP; CSRF; WCAG 2.1 AA; env-only connection strings; mail copy omits join URLs until reveal.

**Scale/Scope**: `/app/events` + detail + ICS + RSVP, upcoming on member home, 3 admin pages, 3 matrix capabilities now built, launch two networks, waitlist included (spec: do not take §11 deferral).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | `/app/events*` session; `/admin/events*` session + MFA layout; `requireRole`; native RLS via `app_role_tokens()`; join URLs not on the member event row | Pass |
| II. Privacy and audit | `event_*` audit same transaction; `track()` opaque id + role + optional opaque `eventId` / `rsvpStatus`; no title/description/URL/PII; append-only; mail uses existing transport | Pass |
| III. Self-operated infra | No new host services in this slice; env-only DB; reminder function exportable for later `infra/` cron; no durable storage URLs | Pass |
| IV. Test-first permission proof | Three event matrix rows built; extra waitlist / reveal / cancel asserts; RLS run without `requireRole`; direct `EXECUTE` of `event_visible_core`, `event_join_revealed`, and **`event_promote_oldest_waitlist`** (own test file, not folded into the generic policy suite) | Pass |
| V. Accessible, token-driven UI | Calendar + admin pages tokens-only; `pnpm test:a11y`; 44px RSVP/toggle; labeled controls | Pass |
| Stack | Reuse Auth.js, Prisma, native RLS, `lib/analytics/track.ts`, `lib/email/transport.ts` | Pass |
| YAGNI | No `ics` npm package, no analytics dashboard, no T−1h “link ready” email, no recurring series, no production crontab in this slice | Pass |
| §11 | Q3 two networks; Q6 existing mailer; Q7 cancel retains row; waitlist **in**; Q13 not this slice | Pass |

No unjustified violations. Complexity Tracking remains empty.

`lib/events/` is **new** because no event helper exists (research §8). Analytics **does** extend `lib/analytics/track.ts`. Email **does** extend `lib/email/transport.ts`. RLS **does not** add a new `authMode`. Audit actions are already listed.

### Post-design (pass)

Phase 1 keeps native RLS (not Prisma `@@rls`), reuses `app_role_tokens()`, evaluates cancel + visibility in `event_visible_core`, stores join URLs in `event_join_links` with reveal policy that **calls** `event_visible_core` (plus Yes + window), applies waitlist in layer 2 under a row lock, generates ICS after `requireRole`, and fail-closes unbuilt matrix rows. `event_promote_oldest_waitlist` is a SECURITY DEFINER write of another user’s row under caller GUCs — same class as the `announcement_dismissible` leak — and has a **standalone** direct-`EXECUTE` test file. Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/006-event-calendar/
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
├── (member)/app/page.tsx                    # EXTEND: upcoming visible events
├── (member)/app/events/page.tsx
├── (member)/app/events/[id]/page.tsx
├── (member)/app/events/[id]/ics/route.ts
├── (member)/app/events/[id]/rsvp/route.ts
├── (admin)/admin/page.tsx                   # EXTEND: Events link
├── (admin)/admin/events/page.tsx
├── (admin)/admin/events/new/page.tsx
└── (admin)/admin/events/[id]/page.tsx
components/                 # calendar month/list, RSVP leaf, admin form (no role logic)
lib/
├── auth/                   # requireRole reused
├── audit/                  # emit event_* (actions already listed)
├── db/rls.ts               # reused as-is (no new authMode)
├── analytics/track.ts      # EXTEND: event_viewed, event_rsvp
├── email/transport.ts      # EXTEND: event invite / reminder / change / cancel kinds
└── events/                 # NEW: create, edit, cancel, list, rsvp, ics, reminders, join-link
prisma/
├── schema.prisma           # Event, EventRsvp, EventJoinLink
└── migrations/             # tables, GIN, checks, event_visible_core, RLS, grants
tests/
├── unit/                   # validation, ICS omit join URL, reminder idempotence, function-def core
├── integration/            # publish, visibility, rsvp/waitlist, ics, reminders, reveal, cancel
├── app/permission-matrix.test.ts  # three event capabilities built
├── rls/                    # events + rsvps + join-link policies; direct EXECUTE leak tests
│   └── event-promote-oldest-waitlist.test.ts  # REQUIRED standalone; not a case inside events-policies
└── a11y/                   # calendar, detail, admin pages
```

**Structure Decision**: Same single Next.js app and route groups as `005-announcements`. Member calendar under `(member)/app/events`. Admin under `(admin)/admin/events` so the existing MFA layout applies. `components/` stay presentational — no `if (role === …)` branches; visibility is data.

## Required standalone tasks (`/speckit-tasks`)

`/speckit-tasks` MUST emit the following as **its own task ID**, fail-first, with this file path. Do **not** fold it into a generic “write events RLS tests” item. Helper-path waitlist tests do not satisfy this.

- Write failing tests in `tests/rls/event-promote-oldest-waitlist.test.ts` that `SELECT event_promote_oldest_waitlist($eventId)` as `amend_app` (raw SQL `EXECUTE`, **not** `lib/events` RSVP helper). Caller GUCs are a member who is **not** staff and **not** the waitlisted user. Cover both a same-cohort event and a cross-cohort event. Assert the three cases in [contracts/rls-policies.md](./contracts/rls-policies.md) § Direct EXECUTE `event_promote_oldest_waitlist`.

## Complexity Tracking

> No constitution violations to justify.
