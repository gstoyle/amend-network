# Data Model: Programme Cohorts

## Cohort (`networks`, existing table)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | Token suffix: `cohort:<id>` |
| name | text unique | 1–120 chars, trimmed; case-insensitive uniqueness enforced in app |
| program_role | enum `pathways \| lead` | Immutable after create (`none` refused) |
| archived_at | timestamptz null | **New.** Null = active. Archive hides from registration, invites, and new targeting only |
| created_at | timestamptz | Existing |

State: `active ⇄ archived`. No delete.

## Cohort membership (`user_networks`, existing table)

| Field | Type | Notes |
|-------|------|-------|
| user_id | uuid FK users | |
| network_id | uuid FK networks | |
| created_at | timestamptz | |

Rules:
- The row matching `users.network_id` is the **primary** cohort; it can't be deleted directly (trigger).
- Insert only for users with `program_role <> 'none'`.
- A user may hold cohorts in both programmes; programme tokens derive from all memberships (existing `app_member_program_roles()`).

## Visibility (content tables: resources, events, announcements, forum_categories)

`visibility text[]`, GIN-indexed (unchanged). Allowed tokens: `all_authenticated`, `pathways`, `lead`, `cohort:<uuid>`. Format enforced by `visibility_tokens_valid()`. Forum categories additionally exclude `all_authenticated`.

## Session claims

`SessionClaims.cohortIds: string[]`: the caller's memberships, or every cohort for Moderator. It isn't used for Admin and Super Admin, who bypass in policies.

## Audit actions (new)

`cohort_created`, `cohort_renamed`, `cohort_archived`, `cohort_unarchived`, `cohort_member_added`, `cohort_member_removed`. `entity_type` is `network` or `user_network`. Metadata carries ids only, never names or emails.

## Migration of existing data

- No content rewrite. Existing `pathways`/`lead` tokens keep their meaning.
- *Norway & Northern Ireland | Fall 2026* and *LEAD* become active cohorts as-is.
- Audit CHECK constraint extended; content CHECK constraints swapped to `visibility_tokens_valid()`.
