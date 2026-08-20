# Implementation Plan: Community Forum

**Branch**: `013-community-forum` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

## Summary

Add a role-gated forum on the existing visibility set (`all_authenticated | pathways | lead`), three-layer authorization, allowlisted markdown (no HTML, no image uploads), rate limits, per-thread email, and staff hide/delete/lock/pin. Defer suspension, bulk hide, @-mentions, and weekly digest per PRD §11.

## Technical Context

**Language/Version**: TypeScript, Next.js App Router (existing)

**Primary Dependencies**: Prisma, PostgreSQL RLS, existing `requireRole` / `withRls` / `writeAudit` / `track` / email transport

**Storage**: PostgreSQL 16 (new forum tables, FORCE RLS); no object-storage uploads in this slice

**Testing**: Vitest unit + RLS + permission-matrix + axe layouts

**Target Platform**: Self-hosted VPS via existing deploy path

**Project Type**: Web application

**Performance Goals**: Category and thread lists under typical member latency; no extra client JS beyond existing form controls

**Constraints**: Tokens only; no PII to PostHog; audit append-only; role from session only

**Scale/Scope**: Three seeded categories; hundreds of members; two-level threads

## Constitution Check

- Defense-in-depth: middleware + `requireRole` + RLS on every forum table
- Privacy: markdown allowlist; analytics opaque ids only; emails only to subscribers
- Self-operated: no new vendors
- Test-first permission proof: View / Post / Moderate forum
- Accessible, token-driven UI: PageHeader, existing controls, 44px targets

## Project Structure

```text
specs/013-community-forum/
lib/forum/
app/(member)/app/forum/
app/(admin)/admin/forum/
prisma/migrations/20260819140000_forum/
```

## Phase 0 / 1

See [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/).
