# Data Model: Gated Resource Library

**Feature**: `004-resource-library` | **Cites**: PRD Appendix A.2, spec Key Entities, clarifications 2026-08-17

Enums are Postgres text + check constraints unless noted. Object keys are opaque strings, never URLs.

## Resource

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid PK | Stable across metadata edit and file replace |
| title | text | Required, non-empty, trim |
| preview_text | text | Required, 1–500 chars |
| thumbnail_object_key | text | Private storage key (not a URL) |
| source_label | text | Check: `Amend` \| `Partner Org` \| `External` |
| tags | text[] | 0–10 entries; each 1–40 chars, trimmed |
| file_object_key | text | Private storage key |
| file_size_bytes | bigint | 1..262144000 (250 MiB) |
| file_mime_type | text | Allowlist below |
| visibility | text[] | One or more of `all_authenticated`, `pathways`, `lead`; GIN index |
| download_count | int | Default 0; incremented only on successful download grant |
| uploaded_by | uuid | User id string (no FK to users — same audit-log caution: do not cascade) |
| created_at | timestamptz | “Newest” sort |
| updated_at | timestamptz | Member “last updated” |
| deleted_at | timestamptz nullable | Soft-delete; file keys retained |

**MIME allowlist (file)**: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `image/jpeg`, `image/png`, `video/mp4`.

**Thumbnail**: `image/jpeg` or `image/png` only; max 5 MiB. Required at successful publish.

**Visibility check**: `visibility <@ ARRAY['all_authenticated','pathways','lead']` AND `cardinality(visibility) >= 1`.

**Rules**:

- INSERT only after **both** scans succeed and objects have been promoted from `ingest/` to `resources/{id}/`.
- Failed publish: no row, ingest keys deleted.
- Failed replace: row unchanged, new ingest keys deleted.
- Successful replace: update `file_*`, `thumbnail_object_key` if replaced, `updated_at`; delete previous live keys (not a scan-failure path).
- Soft-delete: set `deleted_at`; do **not** delete storage objects (FR-017). Distinct from FR-026.

**State**:

```text
(no row)  --scan fail / incomplete-->  (no row, objects deleted)
(no row)  --scan pass + INSERT-->  live (deleted_at null, downloadable)
live      --soft-delete-->  withdrawn (deleted_at set; admin can still SELECT)
live      --replace scan pass-->  live (same id, new keys, updated_at)
live      --replace scan fail-->  live (unchanged keys)
```

There is **no** durable `pending_scan` status.

## Ingest object (ephemeral, not a table)

Unguessable keys `ingest/{uuid}/file` and `ingest/{uuid}/thumb`. Exist only between presigned PUT and commit. Commit either promotes (copy + delete ingest) or deletes. Member download helpers MUST refuse to sign any key not stored on a live `resources` row.

## Unchanged entities

User, Session, AuditLog, `visibility_records` (002 fixture — keep). Resource does not FK-delete users.

## AuditLog (emit only)

Same schema as `002-auth-rbac`. This slice emits `resource_created`, `resource_edited`, `resource_deleted`, `resource_downloaded`. `entity_type = 'resource'`, `entity_id = resource.id`. Download: actor, IP, timestamp required. `metadata` MUST NOT contain object keys, titles that are unnecessary, or PII. Allowed metadata: `{ mime, bytes }` optional; no storage URLs.

## Seed (local)

At least: one `all_authenticated`, one `pathways`, one `lead`, one `{pathways, lead}` live PDF (small fixture in repo tests, not production content). Optional withdrawn row for admin list. Files uploaded to local MinIO by seed via `amend_owner` + storage wrapper.
