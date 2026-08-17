# Research: Announcement Banners

**Feature**: `005-announcements` | **Date**: 2026-08-17

All Technical Context unknowns are resolved below. Stack and authorization are inherited from `002-auth-rbac` / `004-resource-library`. The cap ranking from `/speckit-clarify` (2026-08-17) is a product constraint, not open research.

## 1. RLS on `announcements` reuses `app_role_tokens()`

**Decision**: Second product content table. Same GIN-indexed `visibility text[]` and `visibility && app_role_tokens()` as `resources`. Do **not** invent a second token function. Do **not** add `authMode`.

Core window + not-withdrawn + `visibility && app_role_tokens()` is **one** SQL function `announcement_visible_core(uuid)` (see [contracts/rls-policies.md](./contracts/rls-policies.md)). Policies call it; they do not paste those predicates. The function is `SECURITY DEFINER` (`SET search_path = pg_catalog, public`) so its inner `SELECT` on `announcements` does not re-enter the same RLS policy.

| Command | Policy |
| --- | --- |
| SELECT | `announcement_visible_core(id) AND NOT EXISTS (own dismissal)` **OR** `app.admin_role IN ('admin','super_admin')` (scheduled, expired, withdrawn included for admin). |
| INSERT | `app.admin_role IN ('admin','super_admin')` |
| UPDATE | `app.admin_role IN ('admin','super_admin')` |
| DELETE | none; `REVOKE DELETE` from `amend_app` |

The two-banner **cap is not RLS** (needs per-user ordering + `LIMIT 2`). Layer 2 helper `listEligibleBanners` applies `ORDER BY activates_at DESC, id DESC LIMIT 2` after the RLS set. If layer 2 is missed, a member might see more than two in-window visible banners — that is not a cross-role leak.

Dismissed rows: withheld at RLS by `NOT EXISTS` **on top of** `announcement_visible_core` on the member SELECT branch. Admin SELECT is unchanged (queue must still list banners someone dismissed).

Member list/detail queries still add layer-2 filters (window, not withdrawn, visibility tokens). Admin list uses `requireRole({ admin: ['admin','super_admin'], mfa: true })`.

**Rationale**: Constitution I. Window + withdrawn at RLS so a missed layer-2 still cannot show scheduled/expired/withdrawn or the other cohort. Moderator tokens already include both programs. Pending → empty tokens → no rows. Admin with program `none` on member routes sees only `all_authenticated` (same as resources).

**Alternatives considered**:

- Status column + cron to flip `scheduled → active → expired` — rejected; spec forbids a required activation worker.
- Cap inside RLS (`LIMIT` in a policy) — rejected; policies are per-row, not top-N.
- Staff override inside `app_role_tokens()` — rejected; same reason as resources.

## 2. Cap ranking: most recently activated two

**Decision**: Among banners that survive RLS (in window, visible, not withdrawn, not dismissed by this user), show **the most recently activated two**. SQL: `ORDER BY activates_at DESC, id DESC LIMIT 2`. Ranking uses **activation time, not created time** (clarify 2026-08-17 / PRD §5.4). Tie-break on `id DESC` so the result is stable when two rows share `activates_at`.

**Rationale**: Spec FR-013 / SC-005. `id` is the smallest durable tie-break that does not invent a third timestamp.

**Alternatives considered**:

- Rank by `created_at` (“newest”) — rejected; clarify session.
- Rank by `updated_at` — rejected; an edit would jump the queue.
- Random / admin-set priority — not in the PRD.

## 3. Dismissals

**Decision**: Table `announcement_dismissals` with unique `(user_id, announcement_id)`. INSERT is idempotent (`ON CONFLICT DO NOTHING`). No UPDATE/DELETE for `amend_app`.

RLS:

| Command | Policy |
| --- | --- |
| SELECT | `user_id = current_setting('app.user_id')::uuid` **OR** admin/super_admin |
| INSERT | `user_id = current_setting('app.user_id')::uuid` **AND** `announcement_visible_core(announcement_id)` **AND** `announcement_dismissible(announcement_id)`. **No** `NOT EXISTS` dismissal (first INSERT must succeed). Helper uses `ON CONFLICT DO NOTHING` for repeats. `announcement_dismissible` is `SECURITY DEFINER` and calls `announcement_visible_core` (plus `dismissible`) so a direct `EXECUTE` cannot distinguish a LEAD-only / withdrawn / out-of-window row from a missing id. Repeat INSERT is not blocked by member SELECT RLS hiding the dismissed announcement. |
| UPDATE / DELETE | none |

Product path: POST `/app/announcements/[id]/dismiss` after `requireRole` (active member/moderator/admin on member routes). Unknown / invisible / withdrawn / out-of-window ids withhold like not-found (no existence leak). Repeat dismiss succeeds with no extra row.

**Rationale**: FR-014. Persistence across devices requires a table, not a cookie.

**Alternatives considered**: Cookie/localStorage — rejected; spec requires stored per user. Soft-delete the announcement for one user via a visibility hack — rejected.

## 4. Unique impressions and CTA clicks

**Decision**: Persist first-seen / first-click, then call the existing `track()` helper **only when the INSERT succeeds**.

- `announcement_impressions` PK `(user_id, announcement_id)`
- `announcement_cta_clicks` PK `(user_id, announcement_id)` plus `slot` (`primary` \| `secondary`) on the first click only

Emit analytics events `announcement_impression` and `announcement_cta_click`. Payload keys: existing `{ distinctId, programRole, adminRole }` plus opaque `announcementId` (uuid) and, on click, `ctaSlot` (`primary` \| `secondary`). **Never** headline, body, CTA label, or URL.

Impression INSERT happens in `listEligibleBanners` for the **capped two actually returned**, not for banners that lost the cap. CTA: POST `/app/announcements/[id]/cta/[slot]` records (if first) then **302** to the stored destination. Repeat click: no second unique event; still 302 if the banner remains eligible.

Extend `lib/analytics/track.ts` event union and allowlist. Keep the PII denylist; add `headline`, `body`, `ctaLabel`, `url`, `email`, `name`.

**Rationale**: KPI is unique clicks ÷ unique impressions **per announcement** (PRD §2). PostHog may be unset locally (004 pattern). Uniqueness must be true in the application so tests and production do not double-count.

**Alternatives considered**:

- Analytics-only uniqueness — rejected; `track()` no-ops without a key, and tests could not prove SC-009.
- Count every page load as an impression — rejected; would collapse CTR.
- Client beacon — rejected; role check and uniqueness belong on the server.

## 5. Body formatting (no new library)

**Decision**: Store the admin’s body as markdown **source**, not HTML. Allow only `**bold**`, `_italic_` / `*italic*`, and `[label](destination)` where destination passes the same CTA URL rules. On write, reject or strip disallowed constructs so nothing is stored as raw HTML. On read, render to a small safe element tree in a presentational component. No `dangerouslySetInnerHTML` of author text. No new npm markdown/HTML sanitizer in this slice.

**Rationale**: Constitution II (never write raw HTML from user input) and YAGNI (forum is later; a library now is an extra attack surface). Headline is plain text.

**Alternatives considered**: `remark` + `rehype-sanitize` — extra dependency the spec does not require. Store HTML from a rich-text editor — rejected.

## 6. CTA destinations

**Decision**: Zod refine: `https?://` URL (no `javascript:`, `data:`, `file:`, or protocol-relative `//`) **or** a same-origin member path starting with `/app/`. Secondary CTA requires primary. Label and destination are both set or both null. Label ≤ 40 characters.

CTA buttons in HTML point at the **app** click route, not the raw destination, so the click can be recorded after a role check.

**Rationale**: FR-003 / FR-021. Open-redirect and script URLs are a launch risk.

**Alternatives considered**: Allow any string — rejected. Only in-app paths — rejected; program moments may be off-site https.

## 7. Where banners render

**Decision**: Load `listEligibleBanners` from `app/(member)/layout.tsx` and render presentational chrome above `<main>`. Skip when the pending holding page is showing (`/app/pending`). Do not render on `/admin/*` or public/auth routes. Dismiss and CTA are `use client` leaves only.

**Rationale**: Spec assumption “top of authenticated member pages.” Layout keeps every member page consistent without duplicating the query. Pending users have empty tokens anyway; skipping avoids chrome on the holding page.

**Alternatives considered**: Dashboard-only (`/app`) — not what the spec recorded. Middleware injection — rejected; data fetching belongs in a server component after `requireRole`.

## 8. New modules (constitution: say why)

| Path | Why not an extension |
| --- | --- |
| `lib/announcements/` | Announcement domain is not resources, auth, or registration |

Extend: `lib/analytics/track.ts` (new event names + allowlisted opaque fields), `app/(member)/layout.tsx` (chrome), `app/(admin)/admin/page.tsx` (nav link), permission-matrix tests (mark two capabilities built). Do **not** extend `lib/db/rls.ts` with a new `authMode`. Audit actions are already on the check constraint from `002-auth-rbac`.
