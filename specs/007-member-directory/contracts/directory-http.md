# HTTP & page contracts — member directory

Base URL is environment-defined. CSRF on every state-changing request. `/app/*` requires a session (layer 1). Every data path calls `requireRole` from the signed session (layer 2). Queries run inside `withRls` (layer 3).

Client-supplied role fields are ignored.

## Pages (HTML)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/app` | session, status=active | Member home: first-run directory privacy prompt when `directory_privacy_set_at` is null |
| GET | `/app/directory` | same | Searchable list of listings the viewer may see |
| GET | `/app/directory/[id]` | same | Directory profile; field hide applied; other-member view audits |
| GET | `/app/profile/privacy` | same | Listing + three field toggles; plain-language who-can-see copy |
| POST | `/app/profile/privacy` | same + CSRF | Save toggles; sync projection tables; `directory_privacy_changed` |

Redirects: no session → `/login`. Pending on `/app/directory*` or privacy → `/app/pending`. No `/admin/directory` in this slice.

Withholding (member read of other-program, opted-out, deactivated, pending, or unknown id): same empty/not-found as other role-gated content. Do **not** say “hidden,” “other program,” or “opted out.”

## Member reads

`requireRole` with status=active (Pathways, LEAD, or staff with admin_role in Super Admin / Admin / Moderator).

`listDirectory(query)`:

1. Increment/check throttle (empty query counts). If over cap → try-later, **no rows**.
2. `SELECT` listings (+ shown children) under RLS.
3. Decrypt in process; drop fields without shown-child rows.
4. If query non-empty, keep rows where a **visible** field substring-matches (name, network label, shown title, shown DOC label). Hidden title/DOC MUST NOT match.
5. `track('directory_search')` only when the search is allowed (not when throttled).

DTO per row: `id`, display name, network label, initials, optional title/DOC label/email **only if shown**. Never send hidden values as empty strings that imply the field exists.

Detail: same visibility as list. After successful **other-member** load: audit `directory_profile_viewed` + `track('directory_profile_viewed', { viewedUserId })`. Self detail: same DTO as any viewer (public-listing preview); no profile-view audit.

## Member mutations

| Method | Path | Success | Failure |
| --- | --- | --- | --- |
| POST | `/app/profile/privacy` | Set `directory_visible` and three show flags; stamp `directory_privacy_set_at`; upsert/delete listing + shown rows; `directory_privacy_changed` | Unauthorized; CSRF; pending |

Opt-in with `program_role = none` (staff-only): **no listing row** even if they submit listing on; show an explanation that only program members appear. Matrix Super Admin/Admin/Moderator therefore cannot appear.

## Errors

Unauthorized HTML: existing auth deny / redirect. Privacy validation: field-level reasons to the owner. Members never learn why a guessed id was withheld. Rate limit: generic try later; same copy whether or not matches would have existed.

## First-run prompt

When `directory_privacy_set_at` is null, home and directory show a prompt (plain language: who can see them; name/network always if listed; DOC/title/email default hidden) with a control that goes to `/app/profile/privacy`. Saving either on or off clears the prompt.
