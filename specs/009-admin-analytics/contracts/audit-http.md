# HTTP & page contracts — audit log viewer (delta)

Extends `002-auth-rbac` `/admin/audit-log`. Base URL environment-defined. CSRF on POST. Session (layer 1), `requireRole` (layer 2), `withRls` (layer 3). Client-supplied roles ignored.

## Pages

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/audit-log` | `admin ∈ {admin, super_admin}`, `mfa_satisfied` | Paginated trail + filters |
| POST | `/admin/audit-log/export` | **`super_admin` only**, `mfa_satisfied` | CSV of **current filters**; CSRF |

Redirects: no session → `/login`. Admin without MFA → enroll/challenge. Moderator / members → deny, 0 rows.

## Query filters (GET viewer and POST export)

All optional. Combined with AND. Invalid enum/uuid/date → 400, no rows.

| Param | Meaning |
| --- | --- |
| `actor` | `actor_user_id` uuid |
| `action` | Existing audit action allow-list value |
| `from` / `to` | Inclusive `created_at` bounds (ISO date or timestamptz) |
| `severity` | `info` \| `warning` \| `security` |
| `cursor` | Viewer pagination only (existing id cursor) |

Admin: also AND `created_at >= now() - 90 days` even if `from` is older. Super Admin: no clip.

## Viewer GET

Same-transaction `audit_log_viewed` (already `002`). Columns: [data-model.md](../data-model.md) viewer/CSV list (no `metadata`). Empty filters → empty list, not an error.

## Export POST

`requireRole({ admin: ['super_admin'], mfa: true })`. Body or query: same filters as GET (no cursor; full filtered set).

Success: `text/csv; charset=utf-8`, `Content-Disposition: attachment`, UTF-8 BOM optional, header row + RFC 4180 rows. Same-transaction `audit_log_exported` then body. Empty set: headers only + export row.

Admin or other roles: deny, **no** file, **no** `audit_log_exported` row. No export control on the Admin viewer.

CSV MUST NOT include decrypted names, emails, DOC affiliation, or `metadata`.
