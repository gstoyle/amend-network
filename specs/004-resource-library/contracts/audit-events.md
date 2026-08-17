# Audit event contract (this slice)

Writer remains `lib/audit/write(tx, event)` in the **same transaction** as the change. `metadata` MUST NOT contain emails, names, object keys, signed URLs, or scanner output.

## Actions this slice MUST emit

| action | severity | actor | notes |
| --- | --- | --- | --- |
| `resource_created` | info | admin | `entity_type=resource`, `entity_id=id`; only after successful scan+INSERT |
| `resource_edited` | info | admin | metadata edit or successful file replace |
| `resource_deleted` | info | admin | soft-delete only (not scan-failure; scan-failure has no row) |
| `resource_downloaded` | info | downloader | same transaction as `download_count` increment and **before** the signed URL is returned |

Scan failure: **no** `resource_created`. Optional: do not add a new action; admin sees request failure only.

## Check constraint

Resource actions are already on `audit_log.action` from `002-auth-rbac`. No migration of the check list required unless a new action is added (none planned).

## Still not emitted here

Lifecycle, events, forum, directory, audit export. `resource_viewed` is **analytics**, not audit (see research §8).
