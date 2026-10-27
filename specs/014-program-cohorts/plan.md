# Implementation Plan: Programme Cohorts

**Branch**: `014-program-cohorts` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-program-cohorts/spec.md`

## Summary

Turn today's `networks` rows into managed **cohorts** (name, programme, active/archived) and let content target them. A cohort adds one visibility token, `cohort:<uuid>`, to every member of that cohort. Content keeps the existing `visibility text[]` intersection; RLS keeps using `visibility && app_role_tokens()`. The only change in the database's access check is that `app_role_tokens()` also returns the caller's cohort tokens (all cohort tokens for Moderators; Admin and Super Admin already bypass). Staff get an Admin → Cohorts area for lifecycle and memberships. Forms gain cohort choices; audience markers name cohorts; the directory shows cohorts and filters by them.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 LTS

**Primary Dependencies**: Next.js 15 App Router (server components, server actions), Auth.js v5, Prisma, Zod, Tailwind + shadcn/ui tokens

**Storage**: PostgreSQL 16 with RLS. Existing tables `networks`, `user_networks`, `directory_listings`, content tables with GIN-indexed `visibility text[]`

**Testing**: Vitest unit + integration (`pnpm test`), RLS matrix against Postgres (`pnpm test:rls`), axe (`pnpm test:a11y`)

**Target Platform**: Self-managed Ubuntu VPS behind nginx/Cloudflare; Render staging uses `scripts/render.mjs` bootstrap

**Project Type**: Web application (single Next.js project)

**Performance Goals**: No measurable change to member page load. Cohort count is tens, not thousands; token arrays stay small

**Constraints**: Three-layer authorization on every path; append-only audit; no PII or cohort names to PostHog; tokens-only styling; 360px mobile-first; WCAG 2.1 AA

**Scale/Scope**: Two programmes, roughly 2–10 cohorts per programme per year, hundreds to low thousands of members (PRD §11 assumptions)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Defense-in-depth authorization | **Amendment required, then pass** | Visibility vocabulary is fixed at `all_authenticated \| pathways \| lead`. This slice adds `cohort:<uuid>`. Intersection semantics, GIN index, middleware, `requireRole`, query filters, and RLS are all unchanged in shape. Draft MINOR amendment (1.0.0 → 1.1.0) in [research.md](./research.md) §1; implementation blocked until approved. The "exactly one program role" sentence already drifted with dual membership (2026-09-14); the amendment records that too. |
| II. Privacy and audit | Pass | Six new audit actions, written in the same transaction. Cohort names never sent to analytics. Admin member lookup by email uses the existing lookup hash; no plaintext email search. |
| III. Self-operated infra | Pass | Prisma migration only. Added to `RETRY_FAILED_MIGRATIONS` handling only if it fails on Render. No new service. |
| IV. Test-first permission proof | Pass (planned) | New rows in the capability matrix (manage cohorts, manage memberships, view cohort-only content) run through the app and through `pnpm test:rls`. Tests written first per task. |
| V. Accessible, token-driven UI | Pass (planned) | Grouped checkboxes with fieldset/legend; filter is a labelled select; no new colours. `pnpm test:a11y` for new admin pages. |

Post-design re-check: still passes once the amendment is approved. No new tables beyond one audit-check update and a column; no new services or libraries.

## Project Structure

### Documentation (this feature)

```text
specs/014-program-cohorts/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rls.md
│   ├── permission-matrix.md
│   └── http.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                         # Network.archivedAt
└── migrations/2026102xxxxxxx_program_cohorts/migration.sql

lib/
├── db/visibility.ts                      # cohort tokens, parse/validate, audienceLabel with cohort names
├── db/program-labels.ts                  # static programme options only; cohort options are loaded
├── auth/session.ts                       # claims.cohortIds from user_networks (all for Moderator)
├── auth/types.ts                         # SessionClaims.cohortIds
├── cohorts/manage.ts                     # create/rename/archive/unarchive, add/remove membership
├── cohorts/list.ts                       # options for forms, registration, filters, name map
├── audit/actions.ts                      # six cohort actions
├── announcements/validate.ts             # parseVisibility delegates to lib/db/visibility
├── resources/{publish,edit}.ts           # drop local VISIBILITY consts, use shared parser
├── events/publish.ts, forum/validate.ts  # same parser; forum still forbids all_authenticated
├── registration/*                        # network choices exclude archived
└── directory/list.ts                     # cohort labels + cohort filter

app/(admin)/admin/cohorts/page.tsx        # list, add, rename, archive
app/(admin)/admin/cohorts/[id]/page.tsx   # members, add by email, remove
components/cohort-*.tsx                   # presentational forms/lists
components/visibility-fieldset.tsx        # shared programme + cohort checkboxes for 4 forms
lib/guide/articles.ts                     # member + staff articles

tests/unit, tests/integration, tests/rls, tests/a11y
```

**Structure Decision**: Single Next.js project, matching existing slices. New files and why extension was not possible:

- `lib/cohorts/manage.ts` and `lib/cohorts/list.ts`: no existing module owns network lifecycle. `lib/registration/doc-affiliations.ts` is the pattern to copy, but cohorts drive authorization, which doesn't belong in registration.
- `components/visibility-fieldset.tsx`: four forms each render the same static `VISIBILITY_OPTIONS` list. Cohort choices are dynamic, so one shared fieldset replaces four copies instead of adding a fifth.
- Admin cohort pages: there is no admin member list today, so membership management lives on the cohort page.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Visibility vocabulary extended beyond three tokens (Principle I) | Client requires per-cohort separation inside a programme | A new program role per cohort would multiply the enum, RLS branches, and the capability matrix for every trip, and would break "past cohorts keep programme access" |
