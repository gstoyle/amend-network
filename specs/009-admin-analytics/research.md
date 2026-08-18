# Research: Admin Analytics Dashboard

**Feature**: `009-admin-analytics` | **Date**: 2026-08-18

All Technical Context unknowns are resolved below. Stack and authorization are inherited from `002-auth-rbac`. This slice is read-only over existing tables. Clarifications from the spec: identical Admin/Super Admin aggregates; 90-day cap on raw audit rows only; forum views deferred.

## 1. Do not change `audit_log` RLS or add KPI tables

**Decision**: Leave `audit_log` SELECT exactly as `002`: Super Admin full history; Admin `created_at >= now() - 90 days`; others none. Do not add a `kpi_snapshots` table, materialized view, or extra columns on `users` / `resources` / `events`.

Dashboard numbers that need login history older than 90 days (first login, 30-day retention) cannot be computed with Admin’s row-level `SELECT` on `audit_log`. Widening that policy would let Admin read raw old evidence rows (violates PRD §3 and spec FR-013). Storing `first_login_at` would alter `users` (violates spec FR-017).

**Rationale**: Spec FR-011 vs FR-013. Constitution I layer 3 must still hide old **rows**.

**Alternatives considered**:

- Widen Admin `audit_log` SELECT — rejected; leaks evidence rows.
- Set `app.admin_role = super_admin` for Admin dashboard queries — rejected; lies about the signed session.
- Query as `amend_owner` from the app — rejected; bypasses RLS if layer 2 is missed.
- Add `first_login_at` / denormalized counters — rejected; spec forbids table changes.

## 2. One SECURITY DEFINER snapshot returns aggregates only

**Decision**: One function, same pattern as `directory_listing_visible`:

```text
admin_analytics_snapshot(p_network_id uuid) → jsonb
```

`p_network_id` NULL = all networks. Non-null = that `networks.id` (Pathways or LEAD).

`SECURITY DEFINER` + `SET search_path = pg_catalog, public` so inner reads of `audit_log` / `users` / `invitations` / content tables do not re-enter caller RLS. The function **checks** `current_setting('app.admin_role', true) IN ('admin', 'super_admin')` first; otherwise return `'{}'::jsonb` (no counts). `REVOKE ALL FROM PUBLIC`; `GRANT EXECUTE TO amend_app`.

Payload is counts, titles, and opaque content ids only — **never** audit row dumps, emails, names, DOC, IP, or user-agent. Leaderboards (resource titles + `download_count`; event titles + Yes counts) live in the same JSON so Admin and Super Admin cannot diverge.

Direct `EXECUTE` is the layer-3 proof (own test file). App helper `lib/admin-analytics/` is `requireRole` + `withRls` + `$queryRaw` SELECT of this function. **No new `authMode`.**

**Rationale**: Constitution I (GUC gate holds if `requireRole` is skipped). Spec FR-011.

**Alternatives considered**:

- Separate functions per card — extra objects; one snapshot is one round trip.
- Prisma aggregations under Admin RLS for KPIs and DEFINER only for funnel logins — Admin MAM would still match (current month ⊂ 90 days) but two code paths can drift.

## 3. Funnel stages from existing join + `login_success` rows

**Decision**:

| Stage | Count |
| --- | --- |
| Invitation | `invitations` rows with matching `network_id` (all statuses: pending, accepted, expired, revoked) |
| Registration | `users` with `join_source IS NOT NULL` and matching `network_id` (self-registered **and** invited). Seed staff (`join_source` null, `program_role = none`) excluded |
| Approval | Registration set minus pending and denied: invited users (created already active) **or** `status IN ('active','deactivated')`. Denied self-reg stays at registration only |
| First login | Approval set with at least one `audit_log.action = 'login_success'` **after approval time**, `actor_user_id = users.id`. Pending holding-page logins do not count |
| 30-day retention | First-login set whose first post-approval `login_success` was **≥ 30 days ago**, and who have **another** `login_success` with `created_at` in `(first, first + 30 days]` |

Approval time: invited → `users.created_at`. Self-registered → `created_at` of `registration_approved` where `target_user_id = users.id`.

Network filter applies to `invitations.network_id` (invitation stage) and `users.network_id` (later stages). Q3: only Pathways to Change and LEAD.

**Rationale**: Spec FR-007 / FR-008 and `003` invite-completes-as-approved.

**Alternatives considered**:

- Count only `invitation_sent` audit rows — bulk invite is already invitation rows; table is the source of record.
- Use `sessions` for first login — sessions expire at 30 days absolute; retention history would vanish.
- Use `users.last_login_at` — last, not first; no second-login proof.

## 4. `lib/admin-analytics/` is new; audit extends `read.ts`

**Decision**: New helper folder for the snapshot. Do **not** put SQL aggregates in `lib/analytics/track.ts` (PostHog outbound) or in `lib/audit/read.ts` (raw trail). Filters, pagination, `audit_log_viewed`, and Super Admin CSV (`audit_log_exported`) **extend** `lib/audit/read.ts`.

**Rationale**: AGENTS.md: prefer extend; new file when extension mixes concerns. Same justification as `lib/events/`.

**Alternatives considered**:

- `lib/analytics/dashboard.ts` beside `track.ts` — easy to accidentally `track()` a dashboard open (spec forbids new events).

## 5. MAM calendar month is UTC

**Decision**: “Current calendar month” is UTC (`date_trunc('month', now() AT TIME ZONE 'UTC')`). There is no platform timezone env today. Event `timezone_hint` is per-event display, not an org TZ.

MAM = distinct `users.id` where `status = 'active'`, `program_role ∈ {pathways, lead}`, and a `login_success` exists in that UTC month. Staff-only (`program_role = none`) excluded.

**Rationale**: Spec assumption named UTC-equivalent; adding `TZ` would be a new env the constitution did not require.

**Alternatives considered**:

- Viewer-local month — unstable across staff; not server-authoritative.
- New `APP_TIMEZONE` env — extra config; not in `.env.example`.

## 6. Content counts and leaderboards omit withdrawn/cancelled

**Decision**:

- Live resources: `deleted_at IS NULL`; top 10 by `download_count` DESC (lifetime; spec: 30-day window was forum-only), **after** the k=3 filter in §6a.
- Uncancelled events: `cancelled_at IS NULL`; rank by count of `event_rsvps.status = 'yes'` (not waitlist); **top 10** after the same k=3 filter (same cap as resources).
- Current announcements: `deleted_at IS NULL` (not filtered by activate/expire window — that is member-facing banners, not staff inventory).
- No thread leaderboard UI and no flag counts.

**Rationale**: Spec FR-005 / FR-009 / FR-010. Attendance proxy = Yes RSVP.

## 6a. Leaderboard minimum count k=3 (named assumption)

**Decision**: `admin_analytics_snapshot` omits `topResources` rows with `download_count < 3` and `topEvents` rows with Yes count `< 3`. Omission is entire: the row is not returned, not returned with a blank/zero/suppressed count. After that filter, take at most 10 of each, ordered by count DESC. KPI cards and funnel stages are **not** k-filtered (a pending count of 1 still shows).

This is **not** in PRD §6. PRD asks for top-10 downloaded resources and most-attended events for “content planning, not for member-ranking.” It does not set a k. A named event with `yesCount: 1` on a passive dashboard is close to identifying a member’s participation in a small cohort (LEAD especially). That is a different exposure than an Admin opening that event’s RSVP list on purpose. Recorded here and in `docs/decisions/assumptions-log.md` (Design decisions, 2026-08-18). **Unconfirmed by Amend.** Revisit if program leads want k=2, k=5, or no floor.

Constant in SQL (and tests): `3`. Do not take k as a function parameter (that would re-open small-count probing).

**Rationale**: Spec “content, not people”; Constitution II; typical k-anonymity floor of 3.

**Alternatives considered**:

- Show count=1 with no name — still identifies the event; rejected.
- Show the row with count hidden (“<3”) — reveals that *something* happened; rejected (omission, not zeroing).
- Apply k to KPI/funnel integers — rejected; those are program totals, not named-content pairs.
- k as `p_min_count` argument — rejected; would let a caller probe by sweeping k.

## 7. Audit filters and CSV stay on stored trail fields

**Decision**: Extend `listAuditLog` WHERE with AND of: `actor_user_id`, `action` (enum allow-list), `created_at` range, `severity`. Admin window is **also** AND `created_at >= now() - 90 days` (date filter cannot expand it). Super Admin: no window clip.

On-screen columns match CSV: `id`, `created_at`, `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `target_user_id`, `ip`, `user_agent`, `severity`. **Omit** `metadata` (not listed in spec; may grow). Do not decrypt names/emails/DOC.

Export: `POST /admin/audit-log/export` (writes a row → CSRF). `requireRole` `admin: ['super_admin']`, `mfa: true`. Same filters as the viewer. Same transaction: `writeAudit(..., action: 'audit_log_exported')` then return `text/csv`. Empty filter → header-only file + export row. Denied Admin/Moderator: no file, no export row.

Each viewer GET still writes one `audit_log_viewed` (existing). Export does **not** also write viewed.

**Rationale**: Spec FR-012–FR-016. Constitution II: audited Super Admin path without adding profile PII to the file.

**Alternatives considered**:

- GET export — rejected; export is a write.
- Decrypt actor names for the CSV — rejected; spec forbids.

## 8. No product-analytics events

**Decision**: Do not call `track()`. Do not add dashboard event names. Opening `/admin/analytics` is not an audit action.

**Rationale**: Spec FR-017 / FR-018 / FR-022.

## 9. Matrix and `/admin` home

**Decision**: `view_analytics` becomes built: Super Admin and Admin allow; Moderator and members deny. `view_audit_log` stays built (90-day vs full) plus export extra-assert Super Admin only.

`/admin` already allows Moderator (events). Load snapshot **only** after `requireRole({ admin: ['admin','super_admin'], mfa: true })` for cards; Moderator sees existing links, zero KPI numbers.

**Rationale**: Spec FR-001 / FR-002. PRD §3.

## 10. Q3

**Decision**: Funnel segments are the two seeded networks. No network CRUD.

**Rationale**: `docs/decisions/assumptions-log.md` Q3; spec assumption.
