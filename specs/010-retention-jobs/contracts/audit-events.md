# Audit events (this slice)

Writer remains `writeAudit(tx, event)` in the **same** transaction as the mutation. Metadata MUST NOT use keys in `PII_METADATA_KEYS` (`lib/audit/write.ts`).

## Action to add

| action | severity | actor | metadata | notes |
| --- | --- | --- | --- | --- |
| `retention_purged` | `info` | `system` | `{ class, count }` | One row per class that actually removed or anonymized ≥ 1. `class` is a stable token: `audit_security`, `audit_other`, `analytics`, `users_anonymized`, `password_reset_tokens`, `invitations`. |

## CHECK constraint

Extend `audit_log.action` CHECK to include `retention_purged`. Do not remove existing values. Extend `AUDIT_ACTIONS` in `lib/audit/actions.ts`.

## Not emitted

- Per-row deletion detail, emails, names, token hashes, DOC
- `system_setting_changed`
- Product analytics `track()` names

## Retention of these rows

`retention_purged` is **info**. After 3 years it is eligible for the `audit_other` class like any other info row ([spec.md](../spec.md) clarifications).
