# Implementation Plan: Gated Resource Library

**Branch**: `004-resource-library` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-resource-library/spec.md`

## Summary

Deliver PRD §5.5 on top of `002-auth-rbac`: the first product content table using visibility `all_authenticated | pathways | lead`, admin publish (presigned PUT → synchronous ClamAV scan → commit), member search/filter/sort, short-lived signed downloads with audit, soft-delete, and fail-closed ingest (thumbnail failure blocks the resource; rejected objects are deleted).

Technical approach: reuse `requireRole`, `withRls`, and `app_role_tokens()`; add `resources` with native RLS; new `lib/storage/` (S3 SDK only here) and `lib/scan/` (clamd); `lib/resources/` for list/publish/download. Local MinIO + Postgres. No DreamHost. No second authorization model.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, standalone), Auth.js v5, Prisma 6, Tailwind + shadcn/ui tokens, Zod, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (new)

**Storage**: PostgreSQL 16 (local Docker, `amend_app` FORCE RLS). Private S3-compatible bucket (local MinIO; production DreamObjects via env). Optional local `clamd`.

**Testing**: Vitest unit + integration + app permission matrix. `pnpm test:rls` for `resources`. `pnpm test:a11y` on new pages. EICAR scanner double in CI; live clamd optional.

**Target Platform**: Local developer machine. **No** DreamHost dependency.

**Project Type**: Single Next.js full-stack app at repository root (AGENTS.md).

**Performance Goals**: Authenticated shell JS ≤ 180 KB gzip (`use client` only on form/player leaves). Publish a small fixture in < 3 minutes excluding transfer (SC-001). List search usable in < 1 minute (SC-009). Signed GET default 900s (SDK default) for ≤250 MB files.

**Constraints**: Three authorization layers; `requireRole` never mocked in role tests; no client-supplied roles; visibility contract reused not replaced; scan in the same publish/replace request; FR-026 delete rejected objects; audit append-only same transaction as download grant; env-only bucket/endpoint/clamd; CSRF; WCAG 2.1 AA on new pages.

**Scale/Scope**: ~5 new pages, 3 grant/ingest routes, 4 matrix capabilities now built, launch two networks, 250 MiB max file. Launch cohort size does not change visibility or scan rules.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | `/app/resources*` session; `/admin/resources*` session + MFA layout; `requireRole`; native RLS on `resources` via `app_role_tokens()`; no new auth mechanism | Pass |
| II. Privacy and audit | `resource_*` events same transaction; no PII/keys in metadata or PostHog; append-only | Pass |
| III. Self-operated infra | Env-only S3 + clamd; `lib/storage/` only SDK; signed URLs after role check; ClamAV before downloadable; rejected objects deleted | Pass |
| IV. Test-first permission proof | Four resource matrix rows built; extra visibility/soft-delete/scan asserts; RLS run without `requireRole` | Pass |
| V. Accessible, token-driven UI | New pages tokens-only; `pnpm test:a11y`; labeled filters; 44px targets | Pass |
| Stack | Reuse Auth.js, Prisma, native RLS; add S3 SDK in `lib/storage/` only | Pass |
| YAGNI | No job queue, no quarantine, no semantic search, no dashboard widget, no restore UI | Pass |
| §11 | Q3 two networks; Q7 soft-delete retains published files, scan-fail does not; Q13 not this slice | Pass |

No unjustified violations. Complexity Tracking remains empty.

`lib/storage/`, `lib/scan/`, and `lib/resources/` are **new** because no wrappers exist (research §9). RLS **does** extend `lib/db/rls.ts`. Audit **does** emit already-listed actions.

### Post-design (pass)

Phase 1 keeps native RLS (not Prisma `@@rls`), reuses `app_role_tokens()`, presigned PUT + sync scan+commit, EICAR double for CI, `resource_download` auth_mode for count bumps with trigger **RLS-RES-UPD-DL** (`download_count = OLD + 1`, all other columns frozen), INSERT-only audit, and fail-closed matrix rows for unbuilt capabilities. Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/004-resource-library/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md              # created by /speckit-tasks, not this command
```

### Source Code (repository root)

```text
app/
├── (member)/app/resources/page.tsx
├── (member)/app/resources/[id]/page.tsx
├── (member)/app/resources/[id]/download/route.ts
├── (member)/app/resources/[id]/thumbnail/route.ts
├── (member)/app/resources/[id]/file/route.ts
├── (admin)/admin/resources/page.tsx
├── (admin)/admin/resources/new/page.tsx
└── (admin)/admin/resources/[id]/page.tsx
components/                 # library cards, filters, admin form, video leaf (no role logic)
lib/
├── auth/                   # requireRole reused
├── audit/                  # emit resource_* (actions already listed)
├── db/rls.ts               # EXTEND authMode: resource_download
├── storage/                # NEW: S3 client, presign PUT/GET, delete, promote
├── scan/                   # NEW: clamd INSTREAM + test double
├── analytics/              # NEW thin no-op unless POSTHOG_KEY
└── resources/              # NEW: publish, list, grant download, search
prisma/
├── schema.prisma           # Resource model
└── migrations/             # table, GIN, RLS, grants
docker-compose.yml          # EXTEND minio; profile scan: clamav
.env.example                # S3_* and optional CLAMD_*
tests/
├── unit/                   # search escape, MIME/size, EICAR double, visibility tokens
├── integration/            # publish, scan-fail delete, replace, soft-delete, download audit
├── app/permission-matrix.test.ts  # four resource capabilities built
├── rls/                    # resources policies
└── a11y/                   # new pages
```

**Structure Decision**: Same single Next.js app and route groups as `002-auth-rbac`. Member library under `(member)/app/resources`. Admin under `(admin)/admin/resources` so the existing MFA layout applies. `components/` stay presentational — no `if (role === …)` branches; visibility is data.

## Complexity Tracking

> No constitution violations to justify.
