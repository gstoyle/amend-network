# Implementation Plan: Announcement Banners

**Branch**: `005-announcements` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-announcements/spec.md`

## Summary

Deliver PRD §5.4 on top of `002-auth-rbac` / `004-resource-library`: the second product content table using visibility `all_authenticated | pathways | lead`. Admins create time-windowed banners (headline, allowlisted body, up to two CTAs). Members see at most **the most recently activated two** eligible banners (activation time, not created time) at the top of authenticated member pages. Dismissal is per user. Unique impressions and CTA clicks go through the existing opaque analytics helper.

Technical approach: reuse `requireRole`, `withRls`, and `app_role_tokens()`; add `announcements` + `announcement_dismissals` (and uniqueness tables for KPI events) with native RLS; `lib/announcements/` for create/list/dismiss/cta. Eligibility at read time — no activation cron. No DreamHost. No second authorization model.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, standalone), Auth.js v5, Prisma 6, Tailwind + shadcn/ui tokens, Zod. **No new libraries** (markdown allowlist is in-process; analytics helper already exists).

**Storage**: PostgreSQL 16 (local Docker, `amend_app` FORCE RLS). No object storage in this slice.

**Testing**: Vitest unit + integration + app permission matrix. `pnpm test:rls` for `announcements` / dismissals. `pnpm test:a11y` on banner chrome and admin pages.

**Target Platform**: Local developer machine. **No** DreamHost dependency.

**Project Type**: Single Next.js full-stack app at repository root (AGENTS.md).

**Performance Goals**: Authenticated shell JS ≤ 180 KB gzip (`use client` only on dismiss/CTA leaf). Admin create a complete banner in < 3 minutes (SC-001). Queue find scheduled/active/expired in < 1 minute (SC-011). Banner list query returns ≤ 2 rows to the member chrome.

**Constraints**: Three authorization layers; `requireRole` never mocked in role tests; no client-supplied roles; same visibility vocabulary as resources; cap ranking = `activates_at DESC` (tie-break `id DESC`); unique impression/CTA click persist then `track()`; audit append-only same transaction as create/edit/withdraw; CSRF; WCAG 2.1 AA; env-only connection strings.

**Scale/Scope**: Banner chrome on member layout (not a new member section), 3 admin pages, 2 mutation routes (dismiss, CTA), 2 matrix capabilities now built, launch two networks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | `/app/*` session (existing); `/admin/announcements*` session + MFA layout; `requireRole`; native RLS via `app_role_tokens()`; no new auth mechanism | Pass |
| II. Privacy and audit | `announcement_*` audit same transaction; impressions/CTA via existing tracker — opaque id + role labels + optional opaque announcement id / CTA slot; no copy/PII; append-only | Pass |
| III. Self-operated infra | No new host services; env-only DB; no durable storage URLs (none issued) | Pass |
| IV. Test-first permission proof | Two announcement matrix rows built; extra window/cap/dismissal asserts; RLS run without `requireRole` | Pass |
| V. Accessible, token-driven UI | Banner + admin pages tokens-only; `pnpm test:a11y`; 44px dismiss/CTA; labeled controls | Pass |
| Stack | Reuse Auth.js, Prisma, native RLS, `lib/analytics/track.ts` | Pass |
| YAGNI | No activation cron, no analytics dashboard, no email, no new markdown library, no restore UI | Pass |
| §11 | Q3 two networks; Q6 no mail; Q7 withdraw retains row; Q13 not this slice | Pass |

No unjustified violations. Complexity Tracking remains empty.

`lib/announcements/` is **new** because no announcement helper exists (research §8). Analytics **does** extend `lib/analytics/track.ts`. RLS **does not** add a new `authMode`. Audit **does** emit already-listed actions.

### Post-design (pass)

Phase 1 keeps native RLS (not Prisma `@@rls`), reuses `app_role_tokens()`, evaluates the window and withdrawn flag in member SELECT, applies the cap of two in the list helper (`ORDER BY activates_at DESC, id DESC LIMIT 2`), records unique KPI events with `ON CONFLICT DO NOTHING` then `track()`, INSERT-only audit, and fail-closed matrix rows for unbuilt capabilities. Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/005-announcements/
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
├── (member)/layout.tsx                          # EXTEND: banner chrome except /app/pending
├── (member)/app/announcements/[id]/dismiss/route.ts
├── (member)/app/announcements/[id]/cta/[slot]/route.ts
├── (admin)/admin/page.tsx                       # EXTEND: Announcements link
├── (admin)/admin/announcements/page.tsx
├── (admin)/admin/announcements/new/page.tsx
└── (admin)/admin/announcements/[id]/page.tsx
components/                 # banner list, dismiss/CTA leaves, admin form (no role logic)
lib/
├── auth/                   # requireRole reused
├── audit/                  # emit announcement_* (actions already listed)
├── db/rls.ts               # reused as-is (no new authMode)
├── analytics/track.ts      # EXTEND: announcement_impression, announcement_cta_click
└── announcements/          # NEW: create, edit, withdraw, listEligible, dismiss, recordCta
prisma/
├── schema.prisma           # Announcement, AnnouncementDismissal, impression/click uniqueness
└── migrations/             # tables, GIN, checks, RLS, grants
tests/
├── unit/                   # window validation, CTA URL allowlist, markdown allowlist, cap sort, analytics payload
├── integration/            # publish, visibility, cap of two, dismiss, withdraw, unique impression/click
├── app/permission-matrix.test.ts  # two announcement capabilities built
├── rls/                    # announcements + dismissal policies
└── a11y/                   # member chrome + admin pages
```

**Structure Decision**: Same single Next.js app and route groups as `004-resource-library`. Member banners live in `(member)/layout.tsx` so they appear at the top of `/app/*` except pending. Admin under `(admin)/admin/announcements` so the existing MFA layout applies. `components/` stay presentational — no `if (role === …)` branches; visibility is data.

## Complexity Tracking

> No constitution violations to justify.
