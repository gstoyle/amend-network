# Data Model: Announcement Banners

**Feature**: `005-announcements` | **Cites**: PRD Appendix A.2, spec Key Entities, clarify 2026-08-17

Enums are Postgres text + check constraints unless noted. No object-storage keys in this slice.

## Announcement

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | Stable across edits |
| headline | text | Required, 1–120 chars, trim, plain text |
| body | text | Required, 1–1000 chars, markdown **source** (research §5) |
| cta_primary_label | text nullable | Null or 1–40 chars; paired with primary URL |
| cta_primary_url | text nullable | Null or allowed destination (research §6) |
| cta_secondary_label | text nullable | Requires primary CTA; 1–40 chars if set |
| cta_secondary_url | text nullable | Paired with secondary label |
| activates_at | timestamptz | Inclusive window start; cap ranking uses this (not created_at) |
| expires_at | timestamptz | Inclusive window end; **must be > activates_at** |
| visibility | text[] | One or more of `all_authenticated`, `pathways`, `lead`; GIN index |
| dismissible | boolean | Default true |
| created_by | uuid | User id string (no FK to users — same caution as resources) |
| created_at | timestamptz | Not used for the two-banner cap |
| updated_at | timestamptz | Admin last edit |
| deleted_at | timestamptz nullable | Withdraw; row retained |

**Visibility check**: `visibility <@ ARRAY['all_authenticated','pathways','lead']` AND `cardinality(visibility) >= 1`.

**CTA check**: primary label/url both null or both non-empty; secondary both null or both non-empty; secondary implies primary.

**Window check**: `expires_at > activates_at`.

**Derived admin status** (not a column):

```text
withdrawn:  deleted_at IS NOT NULL
scheduled:  deleted_at IS NULL AND now() < activates_at
active:     deleted_at IS NULL AND now() >= activates_at AND now() <= expires_at
expired:    deleted_at IS NULL AND now() > expires_at
```

**State**:

```text
(no row)  --validation fail-->  (no row)
(no row)  --INSERT-->  scheduled or active (depends on activates_at vs now)
scheduled --clock-->  active (no job; read-time)
active    --clock-->  expired (no job; read-time)
scheduled|active --withdraw-->  withdrawn (deleted_at set)
any       --edit-->  same id; members see new copy on next load
```

## AnnouncementDismissal

| Field | Type | Notes |
| --- | --- | --- |
| user_id | uuid | Session user; no FK |
| announcement_id | uuid | References announcements.id |
| dismissed_at | timestamptz | Set on insert |

PK `(user_id, announcement_id)`. Repeat dismiss: no extra row.

## AnnouncementImpression (KPI uniqueness)

| Field | Type | Notes |
| --- | --- | --- |
| user_id | uuid | |
| announcement_id | uuid | |
| created_at | timestamptz | First time this banner was among the capped two shown to this user |

PK `(user_id, announcement_id)`. Insert only from `listEligibleBanners` for returned rows. `ON CONFLICT DO NOTHING`. Then `track('announcement_impression', …)` only if inserted.

## AnnouncementCtaClick (KPI uniqueness)

| Field | Type | Notes |
| --- | --- | --- |
| user_id | uuid | |
| announcement_id | uuid | |
| slot | text | `primary` \| `secondary` (first click only) |
| created_at | timestamptz | |

PK `(user_id, announcement_id)`. First eligible click wins; later clicks (either slot) do not insert or emit a second unique event.

## Unchanged entities

User, Session, AuditLog, Resource, `visibility_records`. Announcement does not FK-delete users.

## AuditLog (emit only)

Same schema as `002-auth-rbac`. This slice emits `announcement_created`, `announcement_edited`, `announcement_deleted`. `entity_type = 'announcement'`, `entity_id = announcement.id`. `metadata` MUST NOT contain headline, body, emails, or CTA URLs. Allowed: `{ visibility }` optional.

Impressions and CTA clicks are **analytics**, not audit.

## Seed (local)

At least: one live `all_authenticated`, one live `pathways`, one live `lead`, one live `{pathways, lead}`, one **scheduled**, one **expired**, one **withdrawn**. Stagger `activates_at` on three live Pathways-visible rows so the cap-of-two independent test has fixtures. Created via `amend_owner` in seed.
