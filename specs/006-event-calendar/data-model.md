# Data Model: Event Calendar

**Feature**: `006-event-calendar` | **Cites**: PRD Appendix A.2, spec Key Entities

Enums are Postgres text + check constraints unless noted. **Join URLs are not columns on `events`.**

## Event

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | Stable across edits |
| title | text | Required, 1–120 chars, trim, plain text |
| description | text | Required, 1–5000 chars, markdown **source** (same allowlist as announcements) |
| starts_at | timestamptz | UTC instant |
| ends_at | timestamptz | UTC instant; **must be > starts_at** |
| timezone_hint | text nullable | Editor label only; members render local time from the instant |
| location | text nullable | Physical address, ≤ 200 chars |
| is_virtual | boolean | If true, a join-link row is required at save |
| capacity | int nullable | Null = unlimited Yes; if set, ≥ 1 |
| visibility | text[] | One or more of `all_authenticated`, `pathways`, `lead`; GIN index |
| host_user_id | uuid nullable | No FK; display name only at layer 2 |
| created_by | uuid | Staff user id; no FK |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| cancelled_at | timestamptz nullable | Soft cancel; row retained |

**Visibility check**: `visibility <@ ARRAY['all_authenticated','pathways','lead']` AND `cardinality(visibility) >= 1`.

**Window check**: `ends_at > starts_at`.

**Derived admin status** (not a column):

```text
cancelled:  cancelled_at IS NOT NULL
upcoming:   cancelled_at IS NULL AND now() < starts_at
in_progress: cancelled_at IS NULL AND now() >= starts_at AND now() <= ends_at
past:       cancelled_at IS NULL AND now() > ends_at
```

**State**:

```text
(no row) --validation fail--> (no row)
(no row) --INSERT--> uncancelled
uncancelled --edit--> same id
uncancelled --cancel--> cancelled (cancelled_at set)
cancelled --member SELECT--> hidden
```

## EventJoinLink

| Field | Type | Notes |
| --- | --- | --- |
| event_id | uuid PK | FK `events.id` ON DELETE restrict |
| url | text | `http`/`https` only; never selected by members unless reveal policy |

Required when `events.is_virtual` is true (enforced in the create/edit helper, not a cross-table check).

## EventRsvp

| Field | Type | Notes |
| --- | --- | --- |
| user_id | uuid | Session user; no FK |
| event_id | uuid | FK `events.id` |
| status | text | `yes` \| `no` \| `maybe` \| `waitlist` |
| waitlisted_at | timestamptz nullable | Set when entering waitlist; used for FIFO; cleared on promotion |
| reminder_sent_at | timestamptz nullable | 24h reminder idempotence |
| created_at | timestamptz | |
| updated_at | timestamptz | |

PK `(user_id, event_id)`. One row per member per event.

**Promotion**: oldest `waitlisted_at` among `status = waitlist` for that event.

## Unchanged entities

User, Session, AuditLog, Resource, Announcement. Events do not FK-delete users.

## AuditLog (emit only)

Same schema as `002-auth-rbac`. This slice emits `event_created`, `event_edited`, `event_cancelled`, `event_rsvp`. `entity_type = 'event'`, `entity_id = event.id`. `metadata` MUST NOT contain title, description, emails, location, or join URLs. Allowed: `{ visibility }`, `{ rsvpStatus }` on RSVP, `{ fromStatus, toStatus }` optional.

Event viewed is **analytics**, not audit.

## Seed (local)

At least: one `all_authenticated`, one `pathways`, one `lead`, one `{pathways, lead}` uncancelled; one cancelled; one virtual (join-link row) starting in ~90 minutes (outside reveal) and one virtual starting in ~30 minutes (inside reveal); one capacity=1 event for waitlist tests. Created via `amend_owner`.
