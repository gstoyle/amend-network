# Implementation Plan: Registration, Invitation & Approval

**Branch**: `003-registration-invitation-approval` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-registration-invitation-approval/spec.md`

## Summary

Deliver PRD §5.2 join paths on top of `002-auth-rbac`: self-registration into Pending, Admin/Super Admin invitation (manual + CSV) with hashed 14-day tokens, invite completion straight to an active program member, a pending approval queue, and an admin-managed DOC affiliation **controlled list** (assumptions log Q2 — unconfirmed by Amend).

Technical approach: extend Prisma + native RLS (new `doc_affiliations` / `invitations`, tighter `users` policies so pending users cannot self-activate); encrypt the person’s affiliation **id** with existing AES-256-GCM; reuse reset-token hashing via `lib/crypto/token.ts`; join-flow helpers in `lib/registration/`; extend `lib/email/transport.ts`; emit lifecycle audit events in the same transaction. Local json mailbox only. No DreamHost.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, standalone), Auth.js v5, Prisma 6, Tailwind + shadcn/ui tokens, `@node-rs/argon2`, Zod, Nodemailer, `csv-parse` (new, CSV only)

**Storage**: PostgreSQL 16 (local Docker). Runtime `amend_app` (FORCE RLS). Migrate `amend_owner` (BYPASSRLS).

**Testing**: Vitest unit + integration + app permission matrix. `pnpm test:rls` for pending-queue / invitations / affiliations / self-activation. `pnpm test:a11y` on new pages.

**Target Platform**: Local developer machine. **No** DreamHost dependency.

**Project Type**: Single Next.js full-stack app at repository root (AGENTS.md).

**Performance Goals**: Authenticated shell JS ≤ 180 KB gzip (`use client` only on form leaves). Self-registration completable in < 3 minutes (SC-001). Approve/deny a record in < 2 minutes (SC-004).

**Constraints**: Three authorization layers; `requireRole` never mocked in role tests; no client-supplied roles; PII AES-256-GCM; invite tokens hashed; audit append-only same transaction; env-only URLs and `ADMIN_ALERT_EMAIL`; CSRF on mutations; WCAG 2.1 AA on new pages; DOC list not free text (Q2).

**Scale/Scope**: ~6 new pages, CSV ≤ 500 rows, two launch networks, seeded DOC fixtures, permission-matrix delta (approve/deny now built). Launch cohort size does not change token or queue rules.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | `/admin/users/*` behind session + MFA layout; `requireRole` admin∈{admin,super_admin}; RLS on new tables and tightened `users` UPDATE | Pass |
| II. Privacy and audit | Affiliation **association** encrypted; denial reason encrypted not in metadata; audit same transaction; no PostHog; tokens not logged | Pass |
| III. Self-operated infra | `AUTH_URL`, `ADMIN_ALERT_EMAIL`, DB URLs from env; local Postgres + json mailbox | Pass |
| IV. Test-first permission proof | Approve/deny matrix A for Admin/Super Admin; extra invite/DOC denies; RLS run without `requireRole` | Pass |
| V. Accessible, token-driven UI | New pages tokens-only; `pnpm test:a11y`; labeled fields; 44px targets | Pass |
| Stack | Reuse Auth.js, Prisma, native RLS, Argon2id, existing crypto | Pass |
| YAGNI | No Postmark production, no directory, no identity vendor, no Network CRUD | Pass |
| §11 | Q2 named proceed (controlled list); Q3 two networks; Q6 local mail | Pass |

No unjustified violations. Complexity Tracking remains empty.

`lib/registration/` is **new** because join-flow is not an extension of `lib/auth/` session/MFA helpers (research §7). Token hashing **does** extend `lib/crypto/`. Email **does** extend `lib/email/transport.ts`.

### Post-design (pass)

Phase 1 keeps native RLS (not Prisma `@@rls`), encrypted affiliation ids (not plaintext FKs), INSERT-only audit, additive `invitation_revoked` check value, public INSERT WITH CHECKs that block privilege escalation, and fail-closed matrix rows for unbuilt capabilities. Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/003-registration-invitation-approval/
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
├── page.tsx                             # unauthenticated: Sign in + Request access
├── (auth)/register/page.tsx             # NEW
├── (auth)/invite/[token]/page.tsx       # NEW
├── (admin)/admin/users/pending/page.tsx # NEW
├── (admin)/admin/users/invite/page.tsx  # NEW
└── (admin)/admin/users/affiliations/page.tsx # NEW
components/                              # register/invite/csv/pending/affiliation forms (no role logic)
lib/
├── auth/                                # unchanged domain; requireRole reused
├── audit/                               # actions list + check constraint consume invitation_revoked
├── crypto/token.ts                      # NEW extract from password-reset hash helper
├── email/transport.ts                   # EXTEND lifecycle kinds
├── db/rls.ts                            # EXTEND authMode union
└── registration/                        # NEW: register, invite, approve, doc-affiliations, csv, sweep
prisma/
├── schema.prisma                        # User delta, DocAffiliation, Invitation
└── migrations/                          # RLS grants/policies
tests/
├── unit/                                # csv validation, token hash, generic copy, metadata denylist
├── integration/                         # register, invite complete, approve/deny, sweep, csv mixed
├── app/permission-matrix.test.ts        # approve/deny built
├── rls/                                 # users insert/update, invitations, affiliations
└── a11y/                                # new pages
```

**Structure Decision**: Same single Next.js app and route groups as `002-auth-rbac`. Public join routes live in `(auth)` (no session required). Admin join routes live under `(admin)/admin/users/*` so the existing MFA layout applies. `components/` stay presentational.

## Complexity Tracking

> No constitution violations to justify.
