# Audit event contract (this slice)

Writer remains `lib/audit/write(tx, event)` in the **same transaction** as the change. `metadata` MUST NOT contain email, names, passwords, tokens, DOC values, or denial reason text.

## Actions this slice MUST emit

| action | severity | actor | notes |
| --- | --- | --- | --- |
| `registration_submitted` | info | nullable / new user id | Only when a **new** pending user is created. Duplicate email: no row that would prove existence to the visitor; do not emit this for duplicates. |
| `registration_approved` | info | admin | `target_user_id` = applicant; `entity_id` = user id |
| `registration_denied` | info | admin | `metadata: { has_reason }` only |
| `role_assigned` | info | admin or `system` on invite accept | `metadata: { program_role }` (label, not PII) |
| `invitation_sent` | info | admin | one per invitation row; `entity_id` = invitation id |
| `bulk_invite_sent` | info | admin | only if one action created ≥ 2 invitations; `metadata: { count }` |
| `invitation_accepted` | info | new user | `entity_id` = invitation id |
| `invitation_expired` | info | `system` | sweep or click-after-expiry transition |
| `invitation_revoked` | info | admin | **additive** to PRD §6 check constraint |
| `system_setting_changed` | info | admin | DOC list; `metadata: { setting: "doc_affiliation", op: "add" \| "edit" \| "deactivate" }` |

## Check constraint

Migrate the `audit_log.action` check to include `invitation_revoked`. Do not remove existing values.

## Still not emitted here

Content, forum, directory, deactivation, hard-delete, audit export.
