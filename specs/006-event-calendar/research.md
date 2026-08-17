# Research: Event Calendar

**Feature**: `006-event-calendar` | **Date**: 2026-08-17

All Technical Context unknowns are resolved below. Stack and authorization are inherited from `002-auth-rbac` / `004` / `005`. Waitlist is in-scope (spec: do not take PRD §11 deferral).

## 1. RLS on `events` reuses `app_role_tokens()`

**Decision**: Third product content table. Same GIN-indexed `visibility text[]` and `visibility && app_role_tokens()`. Do **not** invent a second token function. Do **not** add `authMode`.

Not-cancelled + visibility intersection lives in **one** SQL function `event_visible_core(uuid)` (see [contracts/rls-policies.md](./contracts/rls-policies.md)). Policies **call** it. They MUST NOT paste those predicates. `SECURITY DEFINER` + `SET search_path = pg_catalog, public` so the inner `SELECT` does not re-enter events RLS. Session GUCs still drive `app_role_tokens()`. `REVOKE ALL FROM PUBLIC`; `GRANT EXECUTE TO amend_app`. Direct `EXECUTE` still returns false for other-cohort / cancelled ids (same as missing) because the function keeps the token check — same lesson as `announcement_dismissible`.

Unlike announcements, **there is no activation window on member SELECT**. Past and future uncancelled events belong on the calendar. Cancel is `cancelled_at IS NOT NULL`.

| Command | Policy |
| --- | --- |
| SELECT | `event_visible_core(id)` **OR** `app.admin_role IN ('admin','super_admin','moderator')` (cancelled included for staff queue) |
| INSERT / UPDATE | `app.admin_role IN ('admin','super_admin','moderator')` |
| DELETE | none; `REVOKE DELETE` from `amend_app` |

Member list/detail still add layer-2 filters. Admin/Moderator list uses `requireRole({ admin: ['admin','super_admin','moderator'], mfa: true })`.

**Rationale**: Constitution I. Moderator tokens already include both programs. Pending → empty tokens → no rows. Admin with program `none` on member routes sees only `all_authenticated`.

**Alternatives considered**:

- Time-window on member SELECT (hide past) — rejected; month view must show past events in that month.
- Staff override inside `app_role_tokens()` — rejected; same as resources.

## 2. Virtual join URL is not a column on `events`

**Decision**: Store the join destination on `event_join_links` (`event_id` PK, `url`). Member `SELECT` on `events` cannot return the URL even if layer 2 is skipped.

Reveal SELECT on `event_join_links`:

- staff (`admin` / `super_admin` / `moderator`), **or**
- `event_join_revealed(event_id)` which **calls** `event_visible_core` **and** requires own Yes RSVP **and** `now()` in `[starts_at − 1 hour, ends_at]`

`event_join_revealed` is `SECURITY DEFINER`, must not paste core predicates, must not return the URL (boolean only). Tests: Pathways `EXECUTE` on a LEAD-only id is false; Yes more than 1h before start cannot SELECT the link row.

ICS and mail call the same helper after `requireRole`; they omit the URL unless that SELECT would succeed for that user.

**Rationale**: Postgres RLS is row-level. A `virtual_link` column on `events` would leak to anyone who can see the event row (Maybe, waitlist, Yes-too-early). Constitution I: layer 3 must hold.

**Alternatives considered**:

- Column on `events` + UI hide — rejected; missed layer 2 leaks the Zoom URL.
- Column grants omitting `virtual_link` — Prisma `SELECT *` would break; brittle.
- Return URL from a SECURITY DEFINER getter — extra EXECUTE surface that could return the secret; table + boolean reveal function is narrower.

## 3. RSVP uniqueness, capacity, waitlist

**Decision**: `event_rsvps` unique `(user_id, event_id)`, status `yes | no | maybe | waitlist`. Change is UPDATE in place. `event_rsvp` audit on every successful change (append-only).

Yes vs waitlist is decided in the RSVP helper inside `withRls`, locking the event row (`SELECT … FOR UPDATE`) then counting `status = 'yes'`. If `capacity` is null, Yes is always Yes. If `count(yes) >= capacity`, a Yes attempt becomes waitlist. Maybe/No never consume capacity.

When a Yes seat frees (Yes → No/Maybe, or that user’s Yes is no longer Yes), promote the oldest waitlist (`waitlisted_at` when they entered waitlist) to Yes in the **same transaction** via `event_promote_oldest_waitlist(p_event_id uuid)` and queue the Yes invite email.

That function is `SECURITY DEFINER` and writes another user’s RSVP under **caller-supplied GUCs** — same class of risk as the `app.auth_mode` and `announcement_dismissible` leaks. Helper-path waitlist tests do not prove the EXECUTE surface. `/speckit-tasks` MUST emit a **standalone** fail-first task for `tests/rls/event-promote-oldest-waitlist.test.ts`: `SELECT` the function as `amend_app` (not through `lib/events`), with GUCs for a member who is not staff and not the waitlisted user, on a same-cohort event **and** a cross-cohort event. Assert (1) signature is event-id only / oldest waitlist on that event only, (2) cross-cohort is null + 0 rows, (3) no free seat is null + 0 rows. Full fixtures: [contracts/rls-policies.md](./contracts/rls-policies.md) § Direct EXECUTE.

Capacity shrink on edit: do not demote existing Yes; warn staff; new Yes attempts waitlist (spec assumption).

**Rationale**: Spec FR-014–FR-016. A check constraint cannot express “Yes count ≤ capacity” across rows without a trigger; a transactional lock is enough and stays in the helper (layer 2) while RLS still forbids RSVP on invisible events.

**Alternatives considered**:

- Trigger to enforce cap — heavier; still need promotion logic in the app.
- “Event full” without waitlist — rejected by this spec.

## 4. ICS without a new package

**Decision**: Build a minimal `VCALENDAR` / `VEVENT` string in `lib/events/ics.ts` (UTC `DTSTART`/`DTEND`, escaped `SUMMARY`/`LOCATION`). Serve `GET /app/events/[id]/ics` after `requireRole` + visibility. Filename from opaque id, not title. Join URL included only when reveal would succeed.

**Rationale**: YAGNI; same as in-process markdown allowlist in `005`. RFC 5545 subset is small.

**Alternatives considered**: npm `ics` — extra dependency PRD names but constitution says do not add a library this constitution and spec do not require; in-process meets FR-019.

## 5. Mail and the 24h reminder pass

**Decision**: Extend `lib/email/transport.ts` with event kinds (Yes invite, waitlist-full notice, promotion-to-Yes, 24h reminder, time-change notify, cancel notify). Bodies MUST NOT include join URLs unless reveal would already succeed for that recipient (reminder at T−24h therefore never includes the link).

`runEventReminders(now = new Date())` in `lib/events/reminders.ts`: Yes RSVPs on uncancelled events whose start is in `(now, now+24h]` and `reminder_sent_at` is null → send one mail, set `reminder_sent_at`. Idempotent if the pass runs twice. Tests inject frozen `now`. Production systemd/cron wiring is **out of scope** (same as invitation sweep in `003`).

Staff notify-on-time-change and cancel send to every current RSVP status.

**Rationale**: Spec FR-021 / FR-030; `003` pattern; constitution jobs are cron on the host later.

**Alternatives considered**: Per-request “if now is ~24h send” — racy and misses users who do not load the page.

## 6. Analytics

**Decision**: Extend `track()` with `event_viewed` and `event_rsvp`. Payload: existing `{ distinctId, programRole, adminRole }` plus opaque `eventId` and, on RSVP, `rsvpStatus` ∈ `yes | no | maybe | waitlist`. Denylist already has `title`; add `description`, `location`, `virtualLink`. `event viewed` on successful detail load (not calendar grid hover).

**Rationale**: PRD §2 / §6; Constitution II. Maybe is a non-PII label (spec assumption).

**Alternatives considered**: Client beacon — rejected; role check belongs on the server.

## 7. Calendar UI

**Decision**: `/app/events` server page with month and list. Month/list toggle is a `use client` leaf (query `?view=`). Event chips are links to `/app/events/[id]`. Upcoming list on `app/(member)/app/page.tsx` (extend). No role branches in components.

**Rationale**: Spec US2; Principle V; server components default.

**Alternatives considered**: Full client calendar library — extra JS vs 180 KB budget.

## 8. New modules (constitution: say why)

| Path | Why not an extension |
| --- | --- |
| `lib/events/` | Event domain is not announcements, resources, auth, or registration |

Extend: `lib/analytics/track.ts`, `lib/email/transport.ts`, member home, admin home nav, permission-matrix tests (three capabilities built). Do **not** extend `lib/db/rls.ts` with a new `authMode`. Audit actions already on the `002` check constraint.
