# Data Model: Authentication & Role-Based Access Control

**Feature**: `002-auth-rbac` | **Cites**: PRD Appendix A.1 / A.4, spec Key Entities

Enums are Postgres enums or text + check constraints. PII ciphertext is `bytea` (see research §4).

## Network

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| name | text unique | Seed: `Pathways to Change`, `LEAD` (PRD §11 Q3 assumption) |
| program_role | enum `pathways` \| `lead` | Default program role at approval (approval itself is out of scope) |
| created_at | timestamptz | |

**Rules**: Only these two rows in this slice. Adding a network later is a spec revisit.

## User

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| email_lookup | bytea unique | HMAC-SHA256 of normalized email |
| email_encrypted | bytea | AES-256-GCM |
| password_hash | text | Argon2id |
| first_name_encrypted | bytea nullable | Seed names encrypted |
| last_name_encrypted | bytea nullable | |
| network_id | uuid FK Network nullable | |
| program_role | enum `pathways` \| `lead` \| `none` | Exactly one |
| admin_role | enum `super_admin` \| `admin` \| `moderator` \| `none` | Zero or one; `none` = no admin |
| status | enum `pending` \| `active` \| `deactivated` \| `denied` | |
| mfa_secret_encrypted | bytea nullable | TOTP secret |
| mfa_enabled | boolean | True only after successful enrollment challenge |
| last_login_at | timestamptz nullable | |
| created_at / updated_at | timestamptz | |

**Not in this slice**: `doc_affiliation`, directory visibility, title (registration fields).

**Validation**: Password ≥ 12 characters at set/reset time (never stored). Email normalized lowercase trim before HMAC. `admin_role != none` implies MFA enrollment required before `/admin`.

**State (status)**:

```text
pending  --seed-->  (no self-transition here)
active
deactivated
denied
```

Registration/approval transitions are out of scope; seeds create each state directly.

**State (MFA)**: `mfa_enabled false` → enroll + verify → `true`. Super Admin reset (operator/seed) returns to `false` and clears secret.

## Session

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | Opaque id placed in signed cookie |
| user_id | uuid FK User | |
| token_hash | bytea unique | Hash of random session token if cookie carries token instead of id |
| user_agent | text | |
| ip | inet | |
| created_at | timestamptz | Absolute 30d from this |
| last_seen_at | timestamptz | Sliding 24h |
| expires_at | timestamptz | min(created+30d, last_seen+24h) updated on activity |
| revoked_at | timestamptz nullable | Logout / revoke / password reset |
| mfa_satisfied | boolean | Per session; default false |

**Rules**: Valid session = `revoked_at IS NULL` AND `now() < expires_at` AND user `status` allows access. Password reset sets `revoked_at` on **all** rows for that user. Concurrent rows allowed.

## PasswordResetToken

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK User | |
| token_hash | bytea unique | Hash of the emailed token |
| expires_at | timestamptz | created + 60 minutes |
| consumed_at | timestamptz nullable | |

**Rules**: Single-use. Consume + revoke sessions in one transaction with `password_reset_completed` audit.

## AuthThrottle

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| identifier_hash | bytea unique | HMAC of normalized email (known or unknown) |
| failed_count | int | |
| window_started_at | timestamptz | 15-minute window |
| locked_until | timestamptz nullable | 15 minutes from 10th failure |

**Rules**: 10 failures in 15 minutes → lock 15 minutes. Does not reveal whether a User row exists.

## AuditLog

| Field | Type | Notes |
| --- | --- | --- |
| id | bigserial PK | |
| created_at | timestamptz indexed | |
| actor_user_id | uuid nullable | **No FK** |
| actor_role | text | Snapshot |
| action | text | Check constraint: full PRD §6 enum |
| entity_type | text nullable | |
| entity_id | text nullable | |
| target_user_id | uuid nullable | **No FK** |
| ip | inet | |
| user_agent | text | |
| metadata | jsonb | No PII (no email, names, DOC, secrets) |
| severity | text | `info` \| `warning` \| `security` |

**Rules**: Append-only. `amend_app` has INSERT + SELECT only. Writer must be called inside the same transaction as the change. SELECT policies: Super Admin all rows; Admin `created_at >= now() - 90 days`; others none (enforced in `requireRole` **and** RLS on `audit_log`).

## VisibilityRecord (fixture)

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| title | text | Non-PII fixture label |
| visibility | text[] | Subset of `all_authenticated`, `pathways`, `lead` |
| created_at | timestamptz | |

**Indexes**: GIN on `visibility`.

**RLS**: `SELECT` if `visibility && app_role_tokens()` where tokens are derived from GUCs (`all_authenticated` if status is `active` or administrative; `pathways` / `lead` from program role; Moderator also receives both program tokens for moderation per spec assumption). Pending: no tokens → no rows. `INSERT/UPDATE/DELETE` denied for `amend_app` in this slice (seed via owner).

## Relationships

- User → Network: many-to-one, optional
- User → Session / PasswordResetToken: one-to-many
- AuditLog: no foreign keys (deleted users must not break the trail)
- VisibilityRecord: standalone fixture

## Seed set (required)

Passwords from `SEED_PASSWORD` env (never committed). One user each:

| Email (local only) | program_role | admin_role | status | mfa_enabled |
| --- | --- | --- | --- | --- |
| superadmin@local | none | super_admin | active | true (test secret in env, not git) |
| admin@local | none | admin | active | false (enrollment path) |
| moderator@local | none | moderator | active | true |
| pathways@local | pathways | none | active | false |
| lead@local | lead | none | active | false |
| pending@local | none | none | pending | false |
| denied@local | none | none | denied | false |
| deactivated@local | pathways | none | deactivated | false |

Visibility fixtures: one row each for `{pathways}`, `{lead}`, `{all_authenticated}`, `{pathways,lead}`.
