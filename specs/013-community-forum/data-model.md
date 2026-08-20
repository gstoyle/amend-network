# Data Model: Community Forum

## ForumCategory

| Field | Rules |
| --- | --- |
| id | uuid pk |
| name | 1–80 chars |
| slug | unique, `[a-z0-9-]+` |
| description | 1–500 chars |
| visibility | text[] subset of `{all_authenticated,pathways,lead}`, cardinality ≥ 1 |
| sort_order | int |
| created_at | timestamptz |
| created_by | uuid nullable |

GIN on visibility. Seed: `pathways-welcome` (pathways), `lead-welcome` (lead), `all-members-general` (all_authenticated).

## ForumThread

| Field | Rules |
| --- | --- |
| category_id | fk |
| author_id | uuid |
| title | 1–120 chars |
| pinned, locked | bool |
| last_posted_at | timestamptz |
| created_at | timestamptz |
| hidden_at, deleted_at | timestamptz nullable |

## ForumPost

| Field | Rules |
| --- | --- |
| thread_id | fk |
| author_id | uuid |
| body | markdown source, 1–8000 chars, no `<` `>` |
| created_at, edited_at | timestamptz |
| hidden_at, deleted_at | timestamptz nullable |

## ForumFlag

status: `open | kept | hidden | deleted`

## ForumSubscription

`(user_id, thread_id)` pk

## ForumPostThrottle

Per-user windows for thread/minute, post/minute, post/hour.

## State

- Member-visible post: `deleted_at` and `hidden_at` null, parent thread same, category visible
- Locked thread: no member INSERT posts
- Pin: sort pinned first, then `last_posted_at` desc
