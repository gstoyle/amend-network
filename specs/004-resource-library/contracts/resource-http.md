# HTTP & page contracts — resource library

Base URL is environment-defined. CSRF on every state-changing request. `/app/*` and `/admin/*` require a session (layer 1). Every data path calls `requireRole` from the signed session (layer 2). Queries run inside `withRls` (layer 3).

Client-supplied role fields are ignored.

## Pages (HTML)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/app/resources` | session, status=active | Member list: search, tag chips, source filter, sort |
| GET | `/app/resources/[id]` | session, status=active | Detail + last-updated; video player if MP4 |
| GET | `/admin/resources` | admin ∈ {admin, super_admin}, mfa_satisfied | All visibilities; include withdrawn |
| GET | `/admin/resources/new` | same | Publish form |
| GET | `/admin/resources/[id]` | same | Edit metadata, replace file/thumb, soft-delete |

Redirects: no session → `/login`. Pending on `/app/resources*` → `/app/pending`. Moderator or member on `/admin/resources*` → deny (no resource management data). Admin without MFA → enroll/challenge.

Withholding (member detail/download of hidden, withdrawn, or unknown id): same empty/not-found as out-of-visibility. Do **not** say “deleted” or name the other cohort.

## Member reads

List WHERE: `deleted_at IS NULL` AND `visibility` intersects `visibilityTokens(session)`. Search: `title` OR `preview_text` ILIKE (escaped). Filters: tag containment, `source_label` equality. Sort: `newest` → `created_at DESC`; `downloads` → `download_count DESC`; `title` → `title ASC`.

Cards show title, preview, thumbnail (via thumbnail grant), source, tags. Never raw object keys.

## Grants (short-lived signed GET)

Issued only after role check + RLS load of a **live** row (`deleted_at IS NULL` for members/moderators). Redirect 302 to the signed URL. Default `expiresIn` 900s for file/video; 120s for thumbnail.

| Method | Path | Auth | Side effect |
| --- | --- | --- | --- |
| GET | `/app/resources/[id]/download` | can view that live resource | Same transaction: bump `download_count` (`auth_mode=resource_download`), `resource_downloaded` audit, then redirect |
| GET | `/app/resources/[id]/thumbnail` | can view that live resource | Redirect; no download audit |
| GET | `/app/resources/[id]/file` | can view; used as `<video src>` | Redirect; no download audit |

Admin may use the same grant helpers for moderation/preview of live rows. Withdrawn rows: members/moderators denied; admin workspace does not issue member download grants for withdrawn files in this slice (preview in admin is optional; if present, still no durable URL).

Expired signature: storage rejects; member must hit the grant route again.

## Admin mutations

`requireRole({ admin: ['admin','super_admin'], mfa: true })`.

| Action | Input | Success | Failure |
| --- | --- | --- | --- |
| Request ingest slots | CSRF | Two presigned **PUT** URLs + ingest id (file + thumb keys under `ingest/`) | Unauthorized |
| Publish | ingest id, title, preview (≤500), source, tags (0–10), visibility (≥1 token), declared MIME/size | Scan both; promote keys; INSERT; `resource_created`; resource is already downloadable | Validation; scan fail/error → delete ingest objects, **no row**; admin-visible failure (no member copy) |
| Edit metadata | id, fields | UPDATE; `updated_at`; `resource_edited` | Unauthorized; not found |
| Replace file and/or thumb | id, new ingest id | Scan; promote; update keys; delete old live keys on success; `resource_edited` | Scan fail → delete **new** ingest only; live keys unchanged |
| Soft-delete | id | `deleted_at = now()`; objects retained; `resource_deleted` | Unauthorized |

Publish request does **not** complete until both scan results are known. Thumbnail scan failure fails the whole publish/replace (no placeholder, no thumbnail-less live file).

## Errors

Unauthorized HTML: existing auth deny / redirect. JSON/action errors for ingest/scan: generic “could not publish this file” (or equivalent) to the admin; never scanner signatures or storage internals. Members never learn that a scan failed.

## Out of scope on these routes

Home dashboard “recent resources”, analytics UI, restore-from-soft-delete, public library.
