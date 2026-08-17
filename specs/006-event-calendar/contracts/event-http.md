# HTTP & page contracts — event calendar

Base URL is environment-defined. CSRF on every state-changing request. `/app/*` and `/admin/*` require a session (layer 1). Every data path calls `requireRole` from the signed session (layer 2). Queries run inside `withRls` (layer 3).

Client-supplied role fields are ignored.

## Pages (HTML)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/app` | session, status=active | Member home: upcoming uncancelled visible events |
| GET | `/app/events` | same | Month + list calendar of uncancelled visible events |
| GET | `/app/events/[id]` | same | Detail; RSVP controls; join URL only if reveal would succeed |
| GET | `/admin/events` | admin ∈ {admin, super_admin, **moderator**}, mfa_satisfied | Queue including cancelled |
| GET | `/admin/events/new` | same | Create form |
| GET | `/admin/events/[id]` | same | Edit + cancel |

Redirects: no session → `/login`. Pending on `/app/*` (except holding page) → `/app/pending`. Pathways/LEAD on `/admin/events*` → deny. Staff without MFA → enroll/challenge.

Withholding (member read/RSVP/ICS of hidden, cancelled, or unknown id): same empty/not-found as out-of-visibility. Do **not** say “cancelled” or name the other cohort.

## Member reads

`listVisibleEvents` WHERE (also enforced by RLS): `cancelled_at IS NULL` AND `visibility` intersects `visibilityTokens(session)`. Order for list: `starts_at ASC`. Month view: events overlapping the displayed month.

Detail: same filter by id. After a successful load, `track('event_viewed', { eventId })`. Join URL: query `event_join_links` (RLS reveal) — never a field on the event DTO from `events`.

ICS: `GET /app/events/[id]/ics` — `text/calendar` after the same visibility check. Join URL in `DESCRIPTION`/`URL` only if reveal SELECT succeeds **now**. No unauthenticated public file.

## Member mutations

`requireRole` with status=active. CSRF.

| Method | Path | Success | Failure |
| --- | --- | --- | --- |
| POST | `/app/events/[id]/rsvp` | `status` ∈ {yes, no, maybe}; upsert own row; waitlist if Yes and at capacity; promote oldest waitlist if a Yes seat freed; `event_rsvp` audit; `track('event_rsvp')`; Yes invite mail when becoming Yes | Unauthorized; withhold if not eligible; invalid status |

Waitlist is not a client-submitted status. Client sends Yes; server may persist waitlist.

## Admin mutations

`requireRole({ admin: ['admin','super_admin','moderator'], mfa: true })`.

| Action | Input | Success | Failure |
| --- | --- | --- | --- |
| Create | title, description, starts_at, ends_at, visibility (≥1), optional location / timezone_hint / capacity / is_virtual + url | INSERT event (+ join-link if virtual); `event_created` same transaction | Validation (window, lengths, URL allowlist, markdown, virtual requires URL) |
| Edit | id + fields | UPDATE; `event_edited`; if start/end changed and RSVPs exist, notify dialog + optional custom message then mail RSVPs | Unauthorized; not found |
| Cancel | id | `cancelled_at = now()`; `event_cancelled`; members stop seeing it; mail all RSVPs | Unauthorized |

Capacity shrink: allowed; existing Yes retained; warn in UI; new Yes waitlists.

Edit of join URL: staff only; members still cannot SELECT until reveal.

## Reminder pass (not HTTP)

`runEventReminders(now)` — operator/test. See [data-model.md](../data-model.md) `reminder_sent_at`. Not a public route. Locally invocable (quickstart). Production cron out of scope.

## Errors

Unauthorized HTML: existing auth deny / redirect. Admin validation: field-level reasons. Members never learn why a guessed id was withheld.

## Out of scope on these routes

Announcements, resources, directory, forum, analytics dashboard, recurring series, T−1h “link ready” mail, production crontab.
