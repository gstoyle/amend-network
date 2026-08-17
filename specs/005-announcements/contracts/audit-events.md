# Audit event contract (this slice)

Writer remains `lib/audit/write(tx, event)` in the **same transaction** as the change. `metadata` MUST NOT contain emails, names, headline, body, or CTA URLs.

## Actions this slice MUST emit

| action | severity | actor | notes |
| --- | --- | --- | --- |
| `announcement_created` | info | admin | `entity_type=announcement`, `entity_id=id`; only after successful INSERT |
| `announcement_edited` | info | admin | metadata / window / visibility / CTA edit |
| `announcement_deleted` | info | admin | withdraw only (`deleted_at` set; row retained) |

Validation failure: **no** `announcement_created`.

## Check constraint

Announcement actions are already on `audit_log.action` from `002-auth-rbac`. No migration of the check list required.

## Still not emitted here

Lifecycle, resources, events, forum, directory, audit export. `announcement_impression` and `announcement_cta_click` are **analytics**, not audit (see research §4).
