# Data Model: Registration, Invitation & Approval

**Feature**: `003-registration-invitation-approval` | **Cites**: PRD Appendix A.1, spec Key Entities, [research.md](./research.md)

Inherits `002-auth-rbac` entities. This file is the **delta** plus full shapes for new tables. Enums are Postgres enums. PII ciphertext is `bytea` (AES-256-GCM envelope from `lib/crypto/pii.ts`).

## Network (unchanged)

Seed remains `Pathways to Change` (`pathways`) and `LEAD` (`lead`). No CRUD in this slice. Registration and CSV resolve `network_name` with trim + case-insensitive match on `networks.name`.

## DocAffiliation (new)

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | Encrypted as utf-8 uuid string on user/invitation rows |
| label | text unique | Shared vocabulary; not PII |
| active | boolean | Default true. Public forms offer `active = true` only |
| created_at / updated_at | timestamptz | |
| created_by | uuid nullable | Actor id string, **no FK** |

**Rules**: Admin/Super Admin add, edit `label`, set `active = false`. No hard delete. Seed at least two active fixtures (`Test Agency A`, `Test Agency B`) plus one deactivated (`Test Agency Inactive`) so forms and CSV tests do not depend on production names.

**State**: `active true` → deactivate → `active false`. Reactivate is allowed (same update path; still not a delete).

## User (delta)

Existing columns unchanged. Add:

| Field | Type | Notes |
| --- | --- | --- |
| title_encrypted | bytea nullable | Required at successful self-reg and invite completion |
| doc_affiliation_id_encrypted | bytea nullable | AES-256-GCM of affiliation uuid; required at successful join |
| join_source | enum `self_registered` \| `invited` nullable | Null on pre-slice seed users |
| registration_ip | inet nullable | Self-reg request IP; admin review only; null if unavailable |
| denial_reason_encrypted | bytea nullable | Set only on deny |

**Validation**: First/last name required on join (already encrypted columns). Password ≥ 12 characters (existing hasher). Email normalized lowercase + HMAC lookup (existing). DOC id must decrypt to an affiliation that was **active at selection time**; invite completion re-checks active (deactivated-after-invite → user must pick a new active value).

**State (status)** — now product-driven:

```text
self-register --> pending --approve--> active
                       \--deny--> denied
invite complete -------> active
```

Denied and deactivated remain non-loginable (existing auth). Pending + correct password → holding page (existing). Own-row UPDATE MUST NOT change `status`, `program_role`, or `admin_role` (RLS WITH CHECK).

**Join invariants**:

- Self-register INSERT: `status = pending`, `program_role = none`, `admin_role = none`, `network_id` = requested network, `join_source = self_registered`.
- Invite complete INSERT: `status = active`, `program_role` = invited network’s mapping, `admin_role = none`, `join_source = invited`.
- Approve: `pending` → `active`, `program_role` = chosen network (default requested), `role_assigned` audit.
- Deny: `pending` → `denied`; optional encrypted reason.

## Invitation (new)

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| email_lookup | bytea | HMAC of normalized email |
| email_encrypted | bytea | AES-256-GCM |
| token_hash | bytea unique | SHA-256 of raw token |
| inviter_id | uuid | Admin actor; **no FK** |
| network_id | uuid FK Network | Invited program |
| first_name_encrypted | bytea | |
| last_name_encrypted | bytea | |
| title_encrypted | bytea nullable | Manual invite may omit |
| doc_affiliation_id_encrypted | bytea nullable | Omit on manual; required in CSV and must be active |
| status | enum `pending` \| `accepted` \| `expired` \| `revoked` | Unused = `pending` |
| expires_at | timestamptz | created_at + 14 days |
| expiry_reminder_sent_at | timestamptz nullable | Sweep sets when 3-day notice sent |
| accepted_user_id | uuid nullable | Set on accept; **no FK** |
| created_at | timestamptz | |
| accepted_at / revoked_at | timestamptz nullable | |

**Rules**:

- Raw token ≥ 128 bits (implementation: 32 bytes). Single-use.
- Partial unique index: `(email_lookup)` WHERE `status = 'pending'`.
- Re-issue: new row + new token; previous row stays `expired` or `revoked` (its hash never works).
- CSV invalid if email already has a User **or** a `pending` invitation.
- Consumed (`accepted`): public copy is the PRD “already been used” message.
- `expired` / `revoked` / unknown / tampered: generic unusable invitation; do not imply an account exists.

**State**:

```text
pending --accept--> accepted
      \--sweep/click past expires_at--> expired
      \--admin revoke--> revoked
```

Terminal states do not return to `pending`.

## AuditLog (delta)

No schema change except the `action` check constraint **adds** `invitation_revoked`. Writer and PII metadata denylist unchanged. Events this slice emits: [contracts/audit-events.md](./contracts/audit-events.md).

## Relationships

- User → Network: many-to-one (requested while pending; assigned when active)
- User → DocAffiliation: **logical** via decrypted id; no SQL FK (ciphertext)
- Invitation → Network: many-to-one FK
- Invitation → DocAffiliation: logical via decrypted id
- Invitation / AuditLog: no FKs to User

## Seed additions

Keep the eight `002-auth-rbac` users. Add DOC fixtures above. Do not seed live invitations (tests create them). `SEED_PASSWORD` still from env.

## Retention (policy only)

Invitation rows: 14-day token life is a **status** transition, not a delete. Do not DELETE invitations in this slice (audit integrity). Weekly retention job remains out of scope.
