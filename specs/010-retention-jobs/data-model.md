# Data Model: Data Retention Jobs

**Feature**: `010-retention-jobs` | **Date**: 2026-08-18

No new entity tables. This slice **adds** one audit action, one RLS `auth_mode` value, DELETE grants/policies, and a retention UPDATE policy on `users`. Windows are applied in application predicates with injected `now` ([research.md](./research.md) §2–3).

## Existing entities (predicates only)

### `audit_log`

| Field used | Role in this slice |
| --- | --- |
| `id` | Count deleted rows |
| `created_at` | Age vs 7y (security) or 3y (info/warning) |
| `severity` | Class split |
| `action` | CHECK list gains `retention_purged`; those rows are **info** |

**Rules**: DELETE only under `auth_mode = retention` + admin GUC. Do not UPDATE rows. Same-run `retention_purged` inserts are newer than the cutoff.

### `users`

| Field used | Role in this slice |
| --- | --- |
| `id` | Kept; content FKs stay pointed here |
| `status` | Must remain `deactivated` |
| `email_lookup` / `email_encrypted` | Sentinel HMAC + `encryptPii` |
| Name, title, DOC, denial ciphertext | `encryptPii("")` |
| `mfa_*` | Secret null, enabled false |
| `password_hash` | New Argon2id of random bytes |
| `registration_ip` | Null |
| `directory_visible`, shown flags | False |
| `last_login_at` | Inactivity clock (with deactivation trail) |

**Rules**: No DELETE of the user. No change to `program_role` / `admin_role`. Skip if `email_lookup` already equals sentinel HMAC for `anonymized.{id}@retention.invalid`.

### `directory_listings`, `directory_shown_titles`, `directory_shown_docs`, `directory_shown_emails`

Leftover copies for an anonymized `user_id` are **deleted** (clarification A). Throttle row for that user may be deleted (no PII beyond id; allowed as leftover session-like debris).

### `sessions`, `password_reset_tokens`

Deleted for anonymized users; expired/consumed reset tokens also deleted as their own class (even for active users).

### `invitations`

DELETE where `status IN ('expired','revoked')` only. Pending/accepted untouched (003 sweep still owns expiry **transition**).

### `resources`, `events`, `announcements`

**Out of mutation scope.** `uploaded_by` / `host_user_id` / `created_by` remain the anonymized user’s id.

## New / extended catalog objects

### Audit action `retention_purged`

- `severity`: `info` only
- `actor_role`: `system`
- `metadata`: `{ "class": <enum>, "count": <int> }`
- `class` values: `audit_security` \| `audit_other` \| `analytics` \| `users_anonymized` \| `password_reset_tokens` \| `invitations`

### RLS `app.auth_mode`

Existing modes plus `retention` (job-only).

## State: deactivated user (anonymization)

```text
deactivated + (inactivity start) > now - 3y + not sentinel
  → anonymized (same status, sentinel lookup, empty PII, copies gone)
  → later runs: skip
```

Inactivity start = `max(last_login_at, last account_deactivated.created_at)` with `users.updated_at` if no deactivation trail (fixture fallback).

## Job result (in memory, not a table)

```text
RetentionJobResult {
  auditSecurityDeleted: int
  auditOtherDeleted: int
  analyticsDeleted: int
  usersAnonymized: int
  passwordResetTokensDeleted: int
  invitationsDeleted: int
}
```

Each positive field ⇒ one `retention_purged` row in the same transaction.

## Validation

- Metadata keys not in `PII_METADATA_KEYS`
- Sentinel email is not a real mailbox domain used by members
- Counts are `bigint`/`int` ≥ 0, never PII
- Frozen `now` in tests; production uses `new Date()`
