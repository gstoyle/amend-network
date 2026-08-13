# AGENTS.md â€” Amend Member Network

Private, role-gated member platform for a correctional-system-adjacent user base,
running on infrastructure Amend operates. Read this before proposing any change.

Requirements: `docs/prd/amend-prd.md` (v1.1).
Current feature: the `spec.md` and `plan.md` in the active `specs/` directory.
Hosting decision: `docs/decisions/ADR-0001-dreamhost-hosting.md`.

## Stack

- Next.js 14+ (App Router), TypeScript strict, **standalone output** for self-hosting
- Tailwind CSS + shadcn/ui, themed entirely through CSS custom properties
- Auth.js v5, credentials + TOTP MFA for administrative roles
- PostgreSQL 16, self-hosted, **row-level security enabled**, Prisma
- DreamObjects (S3-compatible) for files, private bucket, signed URLs only
- Postmark (email), PostHog (analytics), Sentry (errors)

## Deployment target

DreamHost Self-Managed VPS, Ubuntu 24.04 LTS.
Node 24 LTS under **systemd** (not PM2), nginx reverse proxy, Let's Encrypt via certbot.
Cloudflare in front for DNS, WAF, and rate limiting. The origin firewall only accepts
80/443 from Cloudflare ranges, so the VPS IP cannot be reached directly.

There is no managed platform. No auto-scaling, no zero-config previews, no vendor KMS,
no vendor backups, no platform WAF. Anything the app needs, the app or `infra/` provides.

## Commands

```
pnpm dev            # local dev server
pnpm build          # next build (standalone)
pnpm test           # vitest unit + integration
pnpm test:rls       # permission matrix run directly against Postgres, app bypassed
pnpm lint
pnpm typecheck      # tsc --noEmit
pnpm test:a11y      # axe-core against built pages
pnpm db:migrate     # prisma migrate deploy
```

Infrastructure scripts live in `infra/` and are run against a host, never locally.

## Layout

```
app/            Next.js routes. (auth)/ (member)/ (admin)/ route groups.
lib/auth/       Session, requireRole, MFA. Server-only.
lib/audit/      Audit log writer. Append-only.
lib/storage/    Single S3-compatible client wrapper. No provider SDK calls elsewhere.
lib/db/         Prisma client and query helpers.
components/     Presentational. No data fetching, no role logic.
infra/          Provisioning, deploy, and backup scripts. Reviewed like production code.
specs/          Spec Kit feature artifacts. One directory per slice.
docs/prd/       Source PRD.
docs/decisions/ ADRs.
docs/runbook/   Operations runbook. Written in Phase 0, not after launch.
```

## Authorization model

Three enforcement layers. All three, every time, no exceptions:

1. Route middleware requires a session for `/app/*` and `/admin/*`.
2. Every server component and route handler calls `requireRole(...)` before
   returning data. Role comes from the signed session, never from the client.
3. Queries carry role-based WHERE clauses **and** PostgreSQL RLS policies are
   enabled on every content table. RLS is native Postgres and does not depend on
   any managed-database vendor. It is the layer that holds when layer 2 is missed.

Content entities have a `visibility` text[] of `all_authenticated | pathways | lead`.
A user sees an entity if any of their roles intersects it. GIN-indexed.

Administrative role is a separate claim from program role. Exactly one program role,
zero or one administrative role.

## Non-negotiables

- Never trust a role claim that came from the client.
- Never expose a direct object-storage URL. Downloads go through an authenticated
  handler that role-checks server-side and then issues a short-lived signed URL.
- Never send PII to PostHog. Opaque user IDs and role labels only.
- Never write raw HTML from user input. Forum content is markdown with a strict allowlist.
- Audit log rows are append-only. Corrections are new rows, never updates.
- No `remember me`. Shared-device access is expected. Session cookies expire on
  browser close in addition to the 24h sliding window.
- No secrets in Git, in test fixtures, or in log lines. Ever.
- PII column encryption is application-layer AES-256-GCM. There is no vendor KMS
  on this infrastructure, and full-disk encryption is not a substitute.
- Never hard-code a hostname, bucket name, region, or connection string. Environment
  variables only, so staging and production stay identical in code.

## Style

- Server components by default. `use client` only at leaf nodes.
- No hard-coded colour, font, or spacing values in components. Tokens only.
- Zod for every external input boundary.
- Errors surfaced to users never leak account state, existence, or reason.
