<!--
Sync Impact Report
- Version change: (unfilled template) → 1.0.0
- Modified principles: all placeholders replaced with project-specific principles
  - [PRINCIPLE_1_NAME] → I. Defense-in-Depth Authorization (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] → II. Privacy and Audit Stewardship (NON-NEGOTIABLE)
  - [PRINCIPLE_3_NAME] → III. Self-Operated Infrastructure
  - [PRINCIPLE_4_NAME] → IV. Test-First Permission Proof (NON-NEGOTIABLE)
  - [PRINCIPLE_5_NAME] → V. Accessible, Token-Driven Interface
- Added sections:
  - Stack and Security Constraints (replaces [SECTION_2_NAME])
  - Development Workflow and Quality Gates (replaces [SECTION_3_NAME])
  - Governance (filled from [GOVERNANCE_RULES])
- Removed sections: none (template comments and placeholders only)
- Follow-up TODOs: none
-->

# Amend Member Network Constitution

## Core Principles

### I. Defense-in-Depth Authorization (NON-NEGOTIABLE)

Authorization is enforced at three independent layers on every data path.
All three MUST run; missing any one is a defect, not a tradeoff.

1. Route middleware MUST require a session for `/app/*` and `/admin/*`.
2. Every server component and route handler MUST call `requireRole(...)`
   before returning data. Role MUST come from the signed session, never
   from the client.
3. Queries MUST carry role-based WHERE clauses, AND PostgreSQL row-level
   security MUST be enabled on every content table. RLS is native Postgres
   and MUST NOT depend on a managed-database vendor. It is the layer that
   holds when layer 2 is missed.

Content entities MUST use a `visibility` text[] of
`all_authenticated | pathways | lead`. A user sees an entity if and only
if any of their roles intersects that set. The column MUST be GIN-indexed.

Administrative role is a separate claim from program role. A user has
exactly one program role and zero or one administrative role.

Every `/admin` route MUST require `mfa_satisfied` on the session, not
only an administrative role claim.

Rationale: this platform serves people who work inside or alongside the
correctional system. Unauthorized cross-role access is a launch-blocking
incident, not a recoverable bug.

### II. Privacy and Audit Stewardship (NON-NEGOTIABLE)

PII MUST stay inside the application boundary except where a Super Admin
explicitly exports it through an audited path.

- Analytics (PostHog) MUST receive opaque user IDs and role labels only.
  Names, emails, DOC affiliation, titles, and free-text profile fields
  MUST NEVER appear in analytics events. An outbound-payload assertion
  MUST fail the build if a denylisted PII field is present.
- Error monitoring (Sentry) MUST scrub PII from request and response
  bodies.
- PII columns MUST be encrypted at rest with application-layer AES-256-GCM.
  The data encryption key lives in the systemd EnvironmentFile and the
  secrets manager. There is no vendor KMS. Full-disk encryption is NOT a
  substitute and does NOT satisfy this requirement.
- Audit log rows are append-only. Corrections are new rows, NEVER updates.
  Every auditable action MUST write synchronously in the same transaction
  as the change.
- Forum and other user-authored content MUST be markdown with a strict
  allowlist. Raw HTML from user input MUST NEVER be written.
- Secrets MUST NEVER appear in Git, test fixtures, log lines, or build
  artefacts.

Rationale: 7-year audit retention and a corrections-adjacent user base
make data leakage and silent log mutation unacceptable.

### III. Self-Operated Infrastructure

The platform runs on a DreamHost Self-Managed VPS that Amend operates.
There is no managed application platform: no vendor KMS, no vendor
backups, no platform WAF, no auto-scaling, no zero-config previews.

Anything the application needs, the application or `infra/` MUST provide.
Do not assume a capability the `infra/` directory does not implement.

- Hostnames, bucket names, regions, and connection strings MUST come from
  environment variables only. Staging and production MUST be identical
  in code.
- Object-storage URLs MUST NEVER be exposed directly. Downloads go through
  an authenticated handler that role-checks server-side, then issues a
  short-lived signed URL. Storage SDK calls live only in `lib/storage/`.
- Uploaded files MUST be scanned by the local ClamAV daemon before a
  resource is marked downloadable.
- `infra/` scripts MUST be idempotent, reviewed as production code, and
  the only way hosts are configured. Nothing is configured by hand
  through a control panel.
- Changes to firewall rules, SSH config, TLS, or backup jobs MUST receive
  human approval before they are applied.
- Nightly `pg_dump --format=custom` MUST be pushed off-box, with WAL
  archiving. A restore drill against a clean VPS is required; a backup
  that has never been restored is not a backup.

Rationale: hosting is a client-directed constraint (ADR-0001). Pretending
managed-platform conveniences exist here creates silent operational gaps.

### IV. Test-First Permission Proof (NON-NEGOTIABLE)

Tests are written first. If implementation exists without a test that
failed before it, that implementation MUST be deleted and restarted.

- Every row of the PRD §3 capability matrix is an assertion (seven roles
  by twenty-one capabilities).
- That matrix MUST run twice: once through the application, once directly
  against Postgres with the application bypassed (`pnpm test:rls`). The
  RLS run is not optional.
- Every route handler MUST have a test that it rejects an unauthorised
  role, not only that it accepts an authorised one.
- The role-check helper MUST NOT be mocked in tests whose purpose is to
  verify the role check.
- The suite MUST run after each task, not only at the end of a feature.

Rationale: RLS is the last line of defense. Proving it independently of
the application is the only way to know layer 3 holds when layer 2 is
missed.

### V. Accessible, Token-Driven Interface

WCAG 2.1 AA is a launch requirement, not a polish item. Compliance is
measured by automated scans (`pnpm test:a11y`) and a manual review.

- Components MUST use design tokens (CSS custom properties via the
  Tailwind theme). Hard-coded colour, font, radius, or spacing values
  are forbidden.
- Contrast MUST meet 4.5:1 for body text and 3:1 for large text,
  interactive boundaries, and focus indicators.
- Every interactive target MUST be at least 44×44 CSS pixels.
- Semantic HTML is required: landmarks, correct heading order, lists as
  lists, a label on every form control. A `div` with `onClick` is not a
  control.
- Design is mobile-first at 360px. Horizontal scroll at 360px is
  forbidden except for explicitly containerised data tables.
- `prefers-reduced-motion` MUST be respected. Autoplay video is
  forbidden. Animation over 5s MUST be user-controlled.
- Server components are the default. `use client` is allowed only at
  leaf nodes, to keep the authenticated shell under the 180 KB gzip
  budget.
- There is no platform image optimisation. `next/image` MUST use a
  configured local loader. LCP (≤ 2.5s at p75 on 4G) MUST be checked
  early, not at the end.

Rationale: members access this on shared and mobile devices. Brand
parity with amend.us is a token change, not a restyle.

## Stack and Security Constraints

The stack is fixed unless the constitution is amended:

- Next.js 14+ (App Router), TypeScript strict, standalone output
- Tailwind CSS + shadcn/ui, themed entirely through CSS custom properties
- Auth.js v5, credentials + TOTP MFA for administrative roles
- PostgreSQL 16, self-hosted, RLS enabled, Prisma
- DreamObjects (S3-compatible), private bucket, signed URLs only
- Postmark (email), PostHog (analytics), Sentry (errors)
- Node 24 LTS under systemd (not PM2), nginx, Let's Encrypt via certbot
- Cloudflare for DNS, WAF, and rate limiting; origin firewall accepts
  80/443 from Cloudflare ranges only
- Background jobs: system cron

Auth and session rules:

- Passwords: Argon2id, minimum 12 characters, no composition rules
  (NIST SP 800-63B). bcrypt only if Argon2 is unavailable, cost ≥ 12.
- Sessions: httpOnly, Secure, SameSite=Lax. 24h sliding, 30d absolute.
  Server-side session record required so logout and revoke invalidate.
  No "remember me". Cookies MUST expire on browser close in addition
  to the sliding window. Shared-device access is expected.
- Lockout: 10 failures in 15 minutes locks for 15 minutes and writes a
  `security` severity audit row.
- Auth failure messages MUST be identical for pending, denied,
  deactivated, and nonexistent accounts. Errors surfaced to users MUST
  NEVER leak account state, existence, or reason.
- Password reset: 60-minute single-use token. Completion invalidates
  all sessions for that user.
- CSRF protection on every state-changing request.
- Zod at every external input boundary.

Code layout constraints:

- `components/` is presentational. No data fetching, no role logic.
- Prefer extending an existing helper over creating a new file. If a
  new file is created, the change MUST state why extension was not
  possible.
- `infra/` scripts run against a host, never as a substitute for local
  application tests.

## Development Workflow and Quality Gates

Requirements live in `docs/prd/amend-prd.md` (v1.1) and the active
`specs/` directory. Implementation MUST cite the section it is built
against. Hosting decisions live in `docs/decisions/`. The operations
runbook in `docs/runbook/` is written in Phase 0, not after launch.

Feature work follows Spec Kit: specify → plan → tasks → implement.
Runtime agent guidance is `AGENTS.md` and `.cursor/rules/`. Those
files MUST remain consistent with this constitution; when they
diverge, this constitution wins and the other artefacts are updated.

A change is not complete until the relevant gates pass:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:rls` for any change that touches authorization, visibility,
  or content-table queries
- `pnpm test:a11y` for any change that adds or alters pages or
  interactive components
- `pnpm build` (standalone) before a deploy candidate is proposed

Complexity MUST be justified in the spec or the PR. YAGNI applies:
do not add a service, library, or abstraction that this constitution
and the active spec do not require.

Where a requirement depends on an unresolved question in PRD §11, the spec
MUST state the dependency explicitly and either stop or proceed on a named,
recorded assumption. Silent assumptions about the DOC affiliation field,
network list, retention windows, data residency, or operational ownership
are not acceptable — each has a compliance consequence.

## Governance

This constitution supersedes conflicting practices in application code,
infrastructure scripts, Cursor rules, agent instructions, and informal
habit. Where those artefacts disagree with this document, they MUST be
changed to match.

Amendments:

1. Propose the change in writing. Name the affected principles, the
   reason, and the migration plan for in-flight specs and running hosts.
2. PATCH: wording, typos, non-semantic clarifications. Technical lead
   may approve.
3. MINOR: new principle or section, or materially expanded guidance.
   Technical lead approval required; in-flight specs MUST be reviewed
   for impact.
4. MAJOR: removal or redefinition of a principle, or any change that
   would make previously compliant code non-compliant. Technical lead
   and Amend executive sponsor approval required. A migration plan is
   mandatory.
5. On approval, bump `CONSTITUTION_VERSION` per the rules above, set
   Last Amended to the approval date, and record the delta in the
   Sync Impact Report at the top of this file.

Compliance review:

- Every pull request MUST be reviewed against the principles in this
  document, not only against style.
- Spec Kit `/speckit-analyze` and `/speckit-implement` MUST treat this
  file as the governing constraint set.
- A principle that cannot be tested or reviewed is not a principle;
  amend it until it is.

Guidance for day-to-day work lives in `AGENTS.md`. This constitution
is the source of truth when guidance and governance conflict.

**Version**: 1.0.0 | **Ratified**: 2026-08-12 | **Last Amended**: 2026-08-12
