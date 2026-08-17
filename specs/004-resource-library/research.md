# Research: Gated Resource Library

**Feature**: `004-resource-library` | **Date**: 2026-08-17

All Technical Context unknowns are resolved below. Stack and authorization are inherited from `002-auth-rbac`. Ingest answers from `/speckit-clarify` (2026-08-17) are product constraints, not open research.

## 1. Object storage: single wrapper + signed URLs

**Decision**: New module `lib/storage/` (constitution: all object-storage SDK calls live only here; no helper exists to extend). Use AWS SDK v3 `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. Client config from env only: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Set `forcePathStyle: true` so local MinIO and DreamObjects both work.

Downloads and thumbnails: after `requireRole` + RLS load, `getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn })`. Default SDK expiry is **900 seconds**; use that for file download and video playback (250 MB on a slow link). Thumbnails: **120 seconds**. Redirect the browser to the signed URL; do **not** proxy bytes through Node. Never put a durable bucket URL in HTML, JSON, or email.

**Rationale**: Constitution III and PRD §5.5. SDK docs: `getSignedUrl(client, command, { expiresIn })` ([aws-sdk-js-v3 s3-request-presigner](https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/README.md)). Path-style + custom endpoint is required for MinIO.

**Alternatives considered**:

- `@aws-sdk/client-s3` calls from route handlers — rejected; constitution forbids SDK use outside `lib/storage/`.
- Proxy 250 MB through Next.js — rejected; blows request limits and the 180 KB shell budget’s server.
- Public bucket + cache-busting URLs — rejected; visibility would not hold.

## 2. Large upload path: presigned PUT, then synchronous scan+commit

**Decision**: Do not stream the 250 MB file through the App Router or Cloudflare. Admin UI:

1. `requireRole` admin/super_admin, MFA-satisfied → mint two **presigned PUT** URLs for unguessable keys under `ingest/{uuid}/file` and `ingest/{uuid}/thumb`.
2. Browser PUTs directly to storage.
3. Admin submit (metadata + ingest ids) is the **publish request**. Server HEAD/GETs the objects, scans both via ClamAV, then either **promotes** to `resources/{id}/…` + INSERT + `resource_created`, or **deletes** both ingest objects and fails the request (FR-026).

Replace-file uses the same ingest prefix; on scan failure delete only the new ingest objects and leave live keys unchanged.

**Rationale**: Spec clarification: the admin waits until scan finishes on the publish/replace request. That request must not carry the file body. Cloudflare and Next body limits cannot guarantee 250 MB. Bytes sitting in `ingest/` are unguessable and are never signed for GET except by the scan/commit helper (which does not issue member URLs).

**Alternatives considered**:

- Multipart POST through Next.js — rejected at 250 MB.
- Async scan after INSERT — rejected; clarification Q1.
- Leave ingest objects on failure — rejected; clarification Q3.

## 3. ClamAV ingest contract

**Decision**: New `lib/scan/` (not a storage SDK; forum images will reuse this later). Production and optional local Docker: TCP to `clamd` INSTREAM (`CLAMD_HOST`, `CLAMD_PORT`, default 3310). Scan **file and thumbnail** before commit. Either failure fails the whole request (clarification Q2). Rejected objects `DeleteObject` immediately; persist no keys.

Tests: injectable scanner. Default test double treats the [EICAR](https://www.eicar.org/) string as infected and everything else as clean so CI can prove FR-026 without waiting for signature updates. `docker compose --profile scan` runs `clamav/clamav` for a live-daemon proof; not required for `pnpm test`.

**Rationale**: Constitution III / PRD §8. Spec requires local/CI to assert clean vs infected without a production host. A real daemon in every unit test is slow and flaky (fresh ClamAV images download CVD files).

**Alternatives considered**:

- HTTP virus-scan SaaS — rejected; self-operated infra, extra network hop.
- Scan-only-in-production — rejected; tests would not prove the gate.
- Quarantine prefix — rejected; clarification Q3.

## 4. RLS on `resources` reuses `app_role_tokens()`

**Decision**: First product content table. Same GIN-indexed `visibility text[]` and `visibility && app_role_tokens()` as `visibility_records`. Additional policies (do **not** invent a second token function):

| Command | Policy |
| --- | --- |
| SELECT | `(visibility && app_role_tokens() AND deleted_at IS NULL)` **OR** `app.admin_role IN ('admin','super_admin')` |
| INSERT | `app.admin_role IN ('admin','super_admin')` |
| UPDATE | RLS USING/WITH CHECK: admin/super_admin **OR** (`resource_download` + live + visible). Row **shape** is trigger **RLS-RES-UPD-DL** (`download_count = OLD + 1`; every other column frozen). WITH CHECK cannot see OLD. |
| DELETE | none; `REVOKE DELETE` from `amend_app` |

Extend `RlsContext.authMode` with `resource_download` in existing `lib/db/rls.ts`. Keep the `002` fixture table; do not delete it.

Member list/detail/download queries still add `visibility: { hasSome: tokens }` and `deleted_at: null` (layer 2). Admin list uses `requireRole({ admin: ['admin','super_admin'], mfa: true })` and may include withdrawn rows.

**Rationale**: Constitution I: reuse the visibility contract. Moderator tokens already include both programs. Pending → empty tokens → no rows. Soft-delete hidden from members/moderators at RLS. Admins can see withdrawn rows if layer 2 is skipped — they are allowed to manage them.

**Alternatives considered**:

- New visibility vocabulary — rejected; spec forbids it.
- Staff override inside `app_role_tokens()` — rejected; would leak role-specific rows to Admin on member routes when layer 2 is missed in a member-shaped way; admin SELECT is a separate policy.
- Members UPDATE `download_count` without `auth_mode` — rejected; too broad.
- WITH CHECK subquery vs stored row for `OLD + 1` — rejected; WITH CHECK sees only NEW, and a same-table subquery is not a reliable OLD snapshot. **RLS-RES-UPD-DL** is a `BEFORE UPDATE` trigger (`contracts/rls-policies.md`).

## 5. Download count for “most downloaded”

**Decision**: Integer `download_count` default 0 on `resources`. Increment in the **same transaction** as `resource_downloaded` (set `auth_mode = 'resource_download'`, UPDATE count, INSERT audit, then sign URL). Members cannot SELECT `audit_log`, so sorting by audit aggregation is impossible under RLS.

**Rationale**: Spec sort option. Audit remains evidence; the counter is a denormalized display field. Failed downloads do not increment.

**Alternatives considered**: Count `audit_log` in the list query — rejected; members have no SELECT on audit. `SECURITY DEFINER` bump function — extra object; `auth_mode` matches 003’s pattern.

## 6. Search

**Decision**: `ILIKE` on `title` and `preview_text` (escape `%`/`_`). Tag filter: `tags @> ARRAY[selected]`. Source filter: equality on `source_label`. Sort: `created_at DESC` (newest), `download_count DESC` (most downloaded), `title ASC` (alphabetical). Launch cohort does not need `pg_trgm` or file-content search.

**Rationale**: Spec keyword = title + preview only. Semantic search is out of scope.

**Alternatives considered**: `tsvector` — extra index for no demonstrated need. Client-side filter — rejected; would over-fetch hidden rows.

## 7. Video playback

**Decision**: If `file_mime_type = video/mp4`, detail page renders a native `<video>` whose `src` is a **900s** signed GET (same as download expiry) issued after the same role check. Browser range requests hit storage, not Node. Do **not** emit `resource_downloaded` for play; emit opaque `resource_viewed` analytics if the analytics helper is called. Explicit download control is omitted for video (spec US8).

**Rationale**: PRD §5.5 edge case. Signed GET already supports HTTP Range on S3-compatible stores.

**Alternatives considered**: HLS packager — out of scope. Force download for MP4 — rejected by spec.

## 8. Analytics (opaque only)

**Decision**: Thin `lib/analytics/track.ts` that no-ops unless `POSTHOG_KEY` is set. Events: `resource_viewed`, `resource_downloaded` with `{ distinct_id: user uuid, role labels }` only. Never send title, tags, or keys. Do not add the admin analytics dashboard.

**Rationale**: FR-021. PostHog may be unset locally (same pattern as json email).

**Alternatives considered**: Wire PostHog as a required local service — rejected; not needed to prove the slice.

## 9. New modules (constitution: say why)

| Path | Why not an extension |
| --- | --- |
| `lib/storage/` | Mandated single wrapper; directory does not exist |
| `lib/scan/` | ClamAV is not a storage SDK; forum will reuse |
| `lib/resources/` | Resource domain is not auth or registration |

Extend: `lib/db/rls.ts` (`resource_download`), `lib/env.ts` (storage + clamd), `lib/audit` (emit existing resource actions — already on the check constraint), permission-matrix tests (mark four capabilities built), `docker-compose.yml` (minio + optional clamav).
