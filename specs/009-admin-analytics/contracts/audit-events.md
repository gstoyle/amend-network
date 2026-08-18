# Audit event contract (delta)

Writer: `lib/audit/write(tx, event)`. Must run in the **same transaction** as the read (view) or file production (export). `metadata` MUST NOT contain email, names, passwords, TOTP secrets, tokens, DOC affiliation, or IP/user-agent copies beyond what the writer already stores in dedicated columns.

## Actions this slice MUST emit

| action | severity | actor_user_id | notes |
| --- | --- | --- | --- |
| `audit_log_viewed` | info | signed-in Admin or Super Admin | Existing `002` call site; keep on each successful viewer GET |
| `audit_log_exported` | info | Super Admin | **New call site.** Same transaction as CSV. Metadata: `rowCount` + boolean filter flags only |

Both actions are **already** on the `audit_log.action` check constraint from `002`. **No migration of the check list.** No other actions.

## Actions this slice MUST NOT emit

New names, product-analytics events, or operational writes. Opening `/admin/analytics` is not an audit event.

## Read (unchanged windows)

| Role | Raw trail | CSV |
| --- | --- | --- |
| Super Admin | full history | yes (current filters) |
| Admin | last 90 days | no |
| others | deny | no |

Denied export MUST NOT insert `audit_log_exported`.
