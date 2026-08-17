# HTTP & page contracts — announcement banners

Base URL is environment-defined. CSRF on every state-changing request. `/app/*` and `/admin/*` require a session (layer 1). Every data path calls `requireRole` from the signed session (layer 2). Queries run inside `withRls` (layer 3).

Client-supplied role fields are ignored.

## Pages (HTML)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/app` and other `/app/*` except `/app/pending` | session, status=active | Member chrome: up to two eligible banners (layout) |
| GET | `/admin/announcements` | admin ∈ {admin, super_admin}, mfa_satisfied | Queue: scheduled / active / expired / withdrawn; filter + sort |
| GET | `/admin/announcements/new` | same | Create form |
| GET | `/admin/announcements/[id]` | same | Edit + withdraw |

Redirects: no session → `/login`. Pending on `/app/*` (except holding page) → `/app/pending`. Moderator or member on `/admin/announcements*` → deny (no management data). Admin without MFA → enroll/challenge.

Withholding (member dismiss/CTA of hidden, withdrawn, out-of-window, or unknown id): same empty/not-found as out-of-visibility. Do **not** say “deleted” or name the other cohort.

## Member reads

`listEligibleBanners` WHERE (also enforced by RLS): `deleted_at IS NULL` AND `now()` in `[activates_at, expires_at]` AND `visibility` intersects `visibilityTokens(session)` AND no dismissal row for this user.

Then **`ORDER BY activates_at DESC, id DESC LIMIT 2`**. Ranking is activation time, not created time.

Chrome shows headline, sanitized body, up to two CTA controls (labels only), dismiss control if `dismissible`. Never dump raw destinations into analytics. CTA `href`/action is the **app** click route.

Impression: after the capped list is known, insert uniqueness rows for those ids; `track('announcement_impression')` only on first insert per user+announcement.

## Member mutations

`requireRole` with status=active (Pathways, LEAD, Moderator, Admin/Super Admin on member routes). CSRF.

| Method | Path | Success | Failure |
| --- | --- | --- | --- |
| POST | `/app/announcements/[id]/dismiss` | Insert dismissal if dismissible and currently eligible; idempotent | Unauthorized; not dismissible; withhold if not eligible |
| POST | `/app/announcements/[id]/cta/[slot]` | `slot` ∈ {primary, secondary}; insert unique click if first; 302 to stored destination | Unauthorized; missing slot; withhold if not eligible |

CTA 302 target is the stored URL/path. Repeat POST still 302 if eligible; unique analytics event does not increment.

## Admin mutations

`requireRole({ admin: ['admin','super_admin'], mfa: true })`.

| Action | Input | Success | Failure |
| --- | --- | --- | --- |
| Create | headline, body, visibility (≥1), activates_at, expires_at, optional CTAs, dismissible (default true) | INSERT; `announcement_created` same transaction | Validation (window, CTA pairing, URL allowlist, lengths, markdown allowlist) |
| Edit | id + fields | UPDATE; `updated_at`; `announcement_edited` | Unauthorized; not found |
| Withdraw | id | `deleted_at = now()`; `announcement_deleted`; members stop seeing it | Unauthorized |

Admin queue filter: derived status (scheduled / active / expired / withdrawn). Default sort: `activates_at DESC`.

## Errors

Unauthorized HTML: existing auth deny / redirect. Admin validation: field-level reasons. Members never learn why a guessed id was withheld.

## Out of scope on these routes

Events, resources, directory, forum, WP feed, analytics dashboard, public banners, activation jobs.
