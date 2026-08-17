# Quickstart: Gated Resource Library (local)

Proves this slice against **local** Postgres 16 and MinIO. No DreamHost. ClamAV Docker is optional; `pnpm test` uses the EICAR test double (research §3).

## Prerequisites

Same as [../../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm, Docker Postgres, `.env` from `.env.example`.

Additional env (names only): `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Optional: `CLAMD_HOST`, `CLAMD_PORT` when using the scan profile. Optional: `POSTHOG_KEY` (unset → analytics no-op).

## Setup

```bash
docker compose up -d postgres minio
pnpm install
pnpm db:migrate
pnpm db:seed
```

Seed still includes the eight auth users and DOC fixtures. New: MinIO bucket from env; a few live resources (shared / Pathways / LEAD / both) plus one withdrawn row. Password = `SEED_PASSWORD`.

Optional live scanner:

```bash
docker compose --profile scan up -d clamav
# set CLAMD_HOST / CLAMD_PORT, then re-run ingest tests
```

## Automated validation

```bash
pnpm test          # includes app matrix; requireRole not mocked
pnpm test:rls      # resources SELECT/INSERT/UPDATE as amend_app
pnpm test:a11y     # axe on /app/resources, /app/resources/[id], /admin/resources*
pnpm typecheck
pnpm lint
```

Expect: resource capabilities **allow/deny** per [permission-matrix.md](./contracts/permission-matrix.md); remaining rows fail-closed; Pathways sees 0 LEAD-only live resources; EICAR (or clamd-infected) publish deletes ingest objects and inserts 0 rows; successful download writes exactly one `resource_downloaded` and increments `download_count`.

## Manual validation (optional)

```bash
pnpm dev
```

| Check | Expect |
| --- | --- |
| Pathways `/app/resources` | Shared + Pathways + both; no LEAD-only; no withdrawn |
| LEAD same | Shared + LEAD + both; no Pathways-only |
| Pending `/app/resources` | Holding page; 0 records |
| Moderator library | All live visibilities; admin publish URLs denied |
| Download a visible PDF | File via short-lived URL (not a durable bucket URL); audit row |
| Guess LEAD-only id as Pathways | Not-found withholding, no file |
| Admin MFA → `/admin/resources/new` | Publish clean PDF + JPEG thumb → appears in member library |
| Publish EICAR as file or thumb | Request fails; nothing in member library; object gone from MinIO |
| Replace with infected file | Prior file still downloads |
| Soft-delete | Disappears for members; still listed as withdrawn for Admin |
| Search title / tag / source / sort | Only visible live rows; empty filters stay empty |

## Contracts

- [resource-http.md](./contracts/resource-http.md)
- [rls-policies.md](./contracts/rls-policies.md)
- [audit-events.md](./contracts/audit-events.md)
- [permission-matrix.md](./contracts/permission-matrix.md)
- [data-model.md](./data-model.md)
