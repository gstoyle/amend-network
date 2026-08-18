# Implementation Plan: Member Directory

**Branch**: `007-member-directory` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-member-directory/spec.md`

## Summary

Deliver PRD §5.6 on top of `002-auth-rbac` / `003-registration-invitation-approval`: a searchable member directory with **opt-in listing** (default off), **uniform field hide** (DOC affiliation, title, email — including staff), **same-program** listing (Pathways↔Pathways, LEAD↔LEAD; Super Admin / Admin / Moderator see both), **30 searches per user per minute**, and `directory_privacy_changed` / `directory_profile_viewed` audit plus opaque analytics.

Technical approach: **do not widen `users` SELECT**. Members still cannot read another user’s `users` row. Directory reads go through projection tables (`directory_listings` + optional shown-field tables) so hidden PII ciphertext is not on a peer-visible row. `directory_listing_visible(uuid)` is one SECURITY DEFINER boolean (active subject + program match or staff). Search decrypts **in process** after RLS (AES-GCM is not SQL-searchable). Reuse `requireRole`, `withRls`, audit writer, and extend `lib/analytics/track.ts`. No new `authMode`. No DreamHost. No second authorization model.

**Q2 / Q12** remain named, Amend-unconfirmed assumptions (`docs/decisions/assumptions-log.md`). This plan proceeds on them.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Next.js 15 (App Router, standalone), Auth.js v5, Prisma 6, Tailwind + shadcn/ui tokens, Zod. **No new libraries.** Search matching is in-process after decrypt.

**Storage**: PostgreSQL 16 (local Docker, `amend_app` FORCE RLS). No object storage (initials only; no avatar upload).

**Testing**: Vitest unit + integration + app permission matrix. `pnpm test:rls` for listings / shown-field tables / throttle. Dedicated fail-first file `tests/rls/directory-listing-visible.test.ts` (direct `EXECUTE` + `users` SELECT not widened) — see Required standalone tasks below. `pnpm test:a11y` on directory, profile, privacy pages.

**Target Platform**: Local developer machine. **No** DreamHost dependency.

**Project Type**: Single Next.js full-stack app at repository root (AGENTS.md).

**Performance Goals**: Authenticated shell JS ≤ 180 KB gzip (`use client` only on search box, privacy form, first-run prompt). Load opted-in same-program listings then filter in process — launch cohort size, not a full-table dump of `users`.

**Constraints**: Three authorization layers; `requireRole` never mocked in role tests; no client-supplied roles; do not widen `users` SELECT; hidden fields excluded from matching and from peer-visible rows; uniform hide (not per-viewer); audit append-only same transaction as privacy change and (other-member) profile view; CSRF on privacy POST; WCAG 2.1 AA; env-only connection strings; no PII / no search query in analytics.

**Scale/Scope**: `/app/directory` + profile, `/app/profile/privacy`, first-run prompt on home/directory, 2 matrix capabilities now built, launch two networks, field-level toggles included (spec: do not take §11 deferral).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research (pass)

| Principle | Gate | Status |
| --- | --- | --- |
| I. Defense-in-depth | `/app/directory*` and `/app/profile/privacy` session; `requireRole`; native RLS via `directory_listing_visible`; `users` SELECT **not** widened | Pass |
| II. Privacy and audit | Privacy/profile-view audit same transaction; `track()` opaque ids + roles only; no names/emails/DOC/query; append-only; PII stays encrypted; hidden ciphertext not on peer-visible rows | Pass |
| III. Self-operated infra | No new host services; env-only DB; no durable avatar URLs | Pass |
| IV. Test-first permission proof | View directory + Appear in directory built; extra same-program / hidden-field / rate-limit asserts; RLS without `requireRole`; direct `EXECUTE` of `directory_listing_visible` (own test file) | Pass |
| V. Accessible, token-driven UI | Directory + privacy tokens-only; `pnpm test:a11y`; 44px search/toggles; labeled controls | Pass |
| Stack | Reuse Auth.js, Prisma, native RLS, `lib/analytics/track.ts`, existing `encryptPii` | Pass |
| YAGNI | No avatar upload, no messaging, no staff override UI, no `users` column grants gymnastics, no search index of plaintext names | Pass |
| §11 | Q2 controlled list (unconfirmed); Q12 opt-in (unconfirmed); field toggles **in**; Q13 not this slice | Pass |

No unjustified violations. Complexity Tracking remains empty.

`lib/directory/` is **new** because no directory helper exists (research §8). Analytics **does** extend `lib/analytics/track.ts`. RLS **does not** add a new `authMode`. Audit actions are already listed.

### Post-design (pass)

Phase 1 keeps native RLS (not Prisma `@@rls`), does not widen `users_select`, evaluates listing visibility in `directory_listing_visible` (DEFINER join to `users.status`), **deletes** listing + shown-field rows when status leaves `active` (research §11 trigger; not read-gate-only), stores hidden-field ciphertext only on shown-field tables, matches search in process after decrypt, rate-limits via own-row throttle table, and fail-closes unbuilt matrix rows. Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/007-member-directory/
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
├── (member)/layout.tsx                      # EXTEND: Directory + Privacy links
├── (member)/app/page.tsx                    # EXTEND: first-run privacy prompt
├── (member)/app/directory/page.tsx
├── (member)/app/directory/[id]/page.tsx
└── (member)/app/profile/privacy/page.tsx
components/                 # search leaf, privacy form, prompt, initials (no role logic)
lib/
├── auth/                   # requireRole reused
├── audit/                  # emit directory_* (actions already listed)
├── db/rls.ts               # reused as-is (no new authMode)
├── analytics/track.ts      # EXTEND: directory_search, directory_profile_viewed
├── crypto/pii.ts           # decrypt in directory list/search
└── directory/              # NEW: list/search, privacy, profile, throttle
prisma/
├── schema.prisma           # User delta + DirectoryListing + shown-field + throttle
└── migrations/             # tables, directory_listing_visible, RLS, grants
tests/
├── unit/                   # search match (hidden excluded), payload denylist, initials
├── integration/            # opt-in, same-program, staff both programs, rate limit, audit
├── app/permission-matrix.test.ts  # view_directory + appear_in_directory built
├── rls/                    # listings + shown-fields + throttle; users SELECT unchanged
│   └── directory-listing-visible.test.ts  # REQUIRED standalone; not folded into a generic suite
└── a11y/                   # directory list, profile, privacy
```

**Structure Decision**: Same single Next.js app and `(member)` route group as `006-event-calendar`. Directory is a **member** surface (`/app/directory`), including for staff viewing both programs — not `/admin`. `components/` stay presentational — no `if (role === …)` branches; who appears is data from helpers.

## Required standalone tasks (`/speckit-tasks`)

`/speckit-tasks` MUST emit the following as **its own task ID**, fail-first, with this file path. Do **not** fold it into a generic “write directory RLS tests” item. Helper-path search tests do not satisfy this.

- Write failing tests in `tests/rls/directory-listing-visible.test.ts` that (1) `SELECT directory_listing_visible($id)` as `amend_app` (raw SQL `EXECUTE`, **not** `lib/directory`), with caller GUCs for a Pathways member who is not staff, on a same-program listing **and** a LEAD listing **and** a deactivated listing; (2) `SELECT` from `users` as that Pathways member returns **0** other-user rows (policy not widened); (3) after a peer hides title, `SELECT` from `directory_shown_titles` as Pathways returns 0 rows for that peer. Assert the cases in [contracts/rls-policies.md](./contracts/rls-policies.md) § Direct EXECUTE `directory_listing_visible`.

## Complexity Tracking

> No constitution violations to justify.
