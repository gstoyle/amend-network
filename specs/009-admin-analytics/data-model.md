# Data Model: Admin Analytics Dashboard

**Feature**: `009-admin-analytics` | **Cites**: PRD Appendix A.4, spec Key Entities, [research.md](./research.md)

**No new tables. No new columns. No change to `audit_log` row shape or check constraint.** This slice reads existing entities and adds one SQL function that returns JSON aggregates.

## Unchanged sources (read)

| Source | Used for |
| --- | --- |
| `users` | Approved count (`status = active`, `program_role ∈ {pathways, lead}`); pending count (`status = pending`); funnel registration/approval (`join_source`, `network_id`, `status`, `created_at`) |
| `invitations` | Funnel invitation stage (`network_id`, any status) |
| `networks` | Segment labels (Pathways to Change / LEAD) |
| `audit_log` | MAM and funnel login stages (`action = login_success`, `actor_user_id`, `created_at`); `registration_approved` for self-reg approval time (`target_user_id`); viewer/export (full row except `metadata` on the CSV) |
| `resources` | Live count + top 10 (`deleted_at IS NULL`, `download_count`, `title`, `id`) |
| `events` + `event_rsvps` | Uncancelled count + Yes-attendance rank (`cancelled_at IS NULL`, `status = 'yes'`, `title`, `id`) |
| `announcements` | Current count (`deleted_at IS NULL`) |

Staff-only users (`program_role = none`) are excluded from approved, MAM, and funnel person stages.

## Snapshot function (new DB object, not a table)

```text
admin_analytics_snapshot(p_network_id uuid) → jsonb
```

| Input | Meaning |
| --- | --- |
| `NULL` | All networks |
| uuid | That `networks.id` only |

**Authorization (inside the function)**: if `app.admin_role` is not `admin` or `super_admin`, return `{}`. MFA is layer 1–2 (session); GUCs do not carry `mfa_satisfied` (same as other admin SELECT policies).

**JSON shape** (all numbers are integers; arrays may be empty):

```text
{
  kpis: {
    approvedMembers,
    mam,
    mamPathways,
    mamLead,
    pendingRegistrations,
    liveResources,
    uncancelledEvents,
    currentAnnouncements
  },
  funnel: {
    invitation,
    registration,
    approval,
    firstLogin,
    retentionEligible,   // first login ≥ 30 days ago
    retained             // subset with a later login in the 30-day window
  },
  topResources: [{ id, title, downloadCount }],  // downloadCount >= 3, then max 10
  topEvents: [{ id, title, yesCount }]           // yesCount >= 3, then max 10
}
```

`funnel` person stages and MAM honor `p_network_id`. Content counts and leaderboards are **platform-wide** (content is not network-scoped). Leaderboard rows with count **< 3** are omitted entirely (not listed with 0 or a hidden number). See [research.md](./research.md) §6a.

**Rules**: DEFINER MUST NOT return `audit_log` rows, ciphertext, emails, names, DOC ids, IP, or user-agent. `REVOKE ALL FROM PUBLIC`. `GRANT EXECUTE TO amend_app`.

## AuditLog (read + two existing writes)

Row shape unchanged (`002`). This slice:

| action | When |
| --- | --- |
| `audit_log_viewed` | Each successful viewer page load (already `002`; keep same-transaction as SELECT) |
| `audit_log_exported` | Each successful Super Admin CSV (new call site; already on the action enum) |

Export metadata keys only: `rowCount` (int), optional filter flags (`hasActor`, `hasAction`, `hasFrom`, `hasTo`, `hasSeverity`) as booleans — **not** actor ids, emails, or query strings if those would duplicate PII. Prefer counts/flags.

Viewer/CSV columns (no `metadata`): `id`, `created_at`, `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `target_user_id`, `ip`, `user_agent`, `severity`.

## Validation

- `p_network_id` if set MUST be an existing network id; unknown → application 404/empty funnel, not a SQL error leak.
- Audit `action` filter MUST be a member of the existing action allow-list.
- `severity` filter: `info` \| `warning` \| `security`.
- Date range: `from <= to`; Admin still clipped to 90 days.
- CSV: UTF-8, header row, RFC 4180 quoting; empty result is headers only.

## State

No entity lifecycle is owned here. Funnel membership is derived (research §3). Audit rows remain append-only.

## Analytics (not tables)

Do **not** emit product-analytics events. Do **not** add a `DirectoryProfileView`-style sampling table.
