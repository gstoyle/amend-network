# Implementation Plan: Admin Analytics Dashboard

**Branch**: `009-admin-analytics` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-admin-analytics/spec.md`

## Summary

Deliver PRD §6 admin dashboard as a **read-only** staff surface on data already written by `002`–`007`: KPI cards (approved members, MAM, pending, live content counts), invitation → registration → approval → first-login → 30-day-retention funnel (by network), resource/event leaderboards (no forum), and a filterable audit viewer with Super-Admin CSV export.

Technical approach: **do not migrate existing tables, `audit_log` RLS, or product-analytics events.** KPI/funnel/leaderboard numbers come from one `SECURITY DEFINER` snapshot function that returns aggregates only, so Admin and Super Admin see identical dashboard figures while Admin `SELECT` on `audit_log` stays last-90-days. Leaderboards omit count < 3 (k=3, named assumption) then cap at 10 for **both** resources and events. Extend `lib/audit/read.ts` with filters + export (`audit_log_exported` already on the action enum). New `lib/admin-analytics/` for the dashboard helper (do not mix with `lib/analytics/track.ts`). No new `authMode`. No PostHog events. No DreamHost.

**PRD §10** KPI-only deferral is declined except forum views. **Q3** remains Pathways and LEAD only.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, standalone), Auth.js v5, Prisma 6, Tailwind + shadcn/ui tokens, Zod. **No new libraries.** CSV is built with the standard library.

**Storage**: PostgreSQL 16 (local Docker, `amend_app` FORCE RLS). **No** new tables or columns. One new SQL function (aggregates only). No object storage.

**Testing**: Vitest unit + integration + app permission matrix. `pnpm test:rls` for snapshot EXECUTE + unchanged `audit_log` 90-day SELECT. Dedicated fail-first file `tests/rls/admin-analytics-snapshot.test.ts` — see Required standalone tasks below. `pnpm test:a11y` on `/admin`, `/admin/analytics`, `/admin/audit-log`.

**Target Platform**: Local developer machine. **No** DreamHost dependency.

**Project Type**: Single Next.js full-stack app at repository root (AGENTS.md).

**Performance Goals**: Authenticated shell JS ≤ 180 KB gzip (`use client` only on funnel network control, audit filter form, export button). Dashboard numbers in < 10s locally (SC-001). CSV of ≥ 200 rows in < 1 minute (SC-007).

**Constraints**: Three authorization layers; `requireRole` never mocked in role tests; no client-supplied roles; `audit_log` SELECT policy **unchanged**; no new audit actions or PostHog events; operational tables not written; export does not decrypt PII; CSRF on export POST; WCAG 2.1 AA; env-only connection strings; UTC calendar month for MAM (no platform TZ env exists).

**Scale/Scope**: `/admin` KPI cards (Admin/Super Admin only), `/admin/analytics`, `/admin/audit-log` filters + Super Admin export. Matrix **View analytics dashboard** moves FC → built. Forum / flags remain FC.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | `/admin/analytics` and `/admin/audit-log` session; `requireRole` + MFA; native RLS: `audit_log` 90-day unchanged; snapshot function GUC-gated | Pass |
| II. Privacy and audit | No new analytics events; CSV is opaque ids + trail fields; export/view writes existing actions same transaction; append-only; no names/emails/DOC in file or PostHog | Pass |
| III. Self-operated infra | No new host services; env-only DB; no durable storage URLs | Pass |
| IV. Test-first permission proof | View analytics + View audit log (export deny for Admin); RLS without `requireRole`; direct `EXECUTE` of snapshot (own test file) | Pass |
| V. Accessible, token-driven UI | Tokens only; `pnpm test:a11y`; 44px filters/export; tables container-scroll at 360px | Pass |
| Stack | Reuse Auth.js, Prisma, native RLS, existing audit writer, no new SDK | Pass |
| YAGNI | No warehouse, no materialized KPI table, no forum, no PostHog query API, no new `authMode` | Pass |
| §11 | Q3 Pathways/LEAD only; Q2/Q7/Q13 not this slice | Pass |

No unjustified violations. Complexity Tracking remains empty.

`lib/admin-analytics/` is **new** because `lib/analytics/track.ts` is outbound product analytics and `lib/audit/read.ts` is the raw trail — neither should own KPI/funnel SQL (research §4). Audit **does** extend `lib/audit/read.ts`. RLS **does not** add a new `authMode`. Audit actions are already listed.

### Post-design (pass)

Phase 1 keeps native RLS (not Prisma `@@rls`), does **not** change `audit_log` SELECT, evaluates dashboard authorization in `admin_analytics_snapshot` (DEFINER, GUC `admin`/`super_admin`, JSON aggregates only — never trail rows), filters/export stay on existing `listAuditLog` + new export helper, CSV omits `metadata` and decrypted PII, and fail-closes unbuilt matrix rows (forum, config). Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/009-admin-analytics/
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
├── (admin)/admin/page.tsx                 # EXTEND: KPI cards if Admin/Super Admin
├── (admin)/admin/analytics/page.tsx       # NEW
├── (admin)/admin/audit-log/page.tsx       # EXTEND: filters
└── (admin)/admin/audit-log/export/route.ts # NEW: Super Admin CSV POST
components/                 # KPI cards, funnel, leaderboards, audit filters (no role logic)
lib/
├── auth/                   # requireRole reused
├── audit/read.ts           # EXTEND: filters + export; viewed/exported writes
├── audit/write.ts          # reused (export action already allowed)
├── db/rls.ts               # reused as-is (no new authMode)
├── analytics/track.ts      # NOT extended
└── admin-analytics/        # NEW: load snapshot (KPIs, funnel, leaderboards)
prisma/
└── migrations/             # admin_analytics_snapshot() only; no table DDL
tests/
├── unit/                   # funnel fixtures, CSV columns, PII denylist on export metadata
├── integration/            # KPI counts, funnel stages, leaderboards, filters, export allow/deny
├── app/permission-matrix.test.ts  # view_analytics built; view_audit_log export deny Admin
├── rls/                    # snapshot EXECUTE; audit_log SELECT 90-day unchanged
│   └── admin-analytics-snapshot.test.ts  # REQUIRED standalone
└── a11y/                   # /admin, /admin/analytics, /admin/audit-log
```

**Structure Decision**: Same single Next.js app and `(admin)` route group as prior slices. `components/` stay presentational — no `if (role === …)` branches; export control is a boolean prop from the server. Moderator keeps `/admin` nav without KPI cards.

## Required standalone tasks (`/speckit-tasks`)

`/speckit-tasks` MUST emit the following as **its own task ID**, fail-first, with this file path. Do **not** fold it into a generic “write analytics RLS tests” item. Helper-path tests do not satisfy this.

- Write failing tests in `tests/rls/admin-analytics-snapshot.test.ts` that (1) `SELECT admin_analytics_snapshot(NULL)` as `amend_app` (raw SQL `EXECUTE`, **not** `lib/admin-analytics`), with caller GUCs for Super Admin **and** Admin, and assert JSON KPI/funnel numbers are **equal**; (2) the same `EXECUTE` as Moderator, Pathways, LEAD, pending returns an empty/denied payload (no counts); (3) as Admin, `SELECT` from `audit_log` still returns **0** rows older than 90 days in the same fixture that the snapshot used for first-login/retention; (4) a live resource with `download_count` 1 or 2 and an uncancelled event with 1 or 2 Yes RSVPs are **absent** from `topResources` / `topEvents` (omission, not a zeroed row), while count ≥ 3 appears; (5) `topEvents` length ≤ 10. Cite [contracts/rls-policies.md](./contracts/rls-policies.md) § Direct EXECUTE `admin_analytics_snapshot` and [research.md](./research.md) §6a.

## Complexity Tracking

> No constitution violations to justify.
