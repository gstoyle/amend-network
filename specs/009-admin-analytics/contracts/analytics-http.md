# HTTP & page contracts — admin analytics

Base URL is environment-defined. CSRF on every state-changing request. `/admin/*` requires a session (layer 1). Every data path calls `requireRole` from the signed session (layer 2) then `withRls` (layer 3). Client-supplied role fields are ignored.

Analytics reads call `admin_analytics_snapshot` (see [rls-policies.md](./rls-policies.md)). They MUST NOT call `track()`.

## Pages (HTML)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/admin` | session, `admin_role ≠ none`, `mfa_satisfied` | Staff home. **KPI cards only if** `admin_role ∈ {admin, super_admin}`. Moderator: existing links, **0** aggregates |
| GET | `/admin/analytics` | session, `admin ∈ {admin, super_admin}`, `mfa_satisfied` | KPI cards, funnel, resource + event leaderboards. Query `network` optional (`all` or network id) |

Redirects: no session → `/login`. Pathways/LEAD/pending → deny (no numbers). Staff without MFA → enroll/challenge. Moderator on `/admin/analytics` → deny (no numbers).

## Analytics read

`requireRole({ admin: ['admin', 'super_admin'], mfa: true })`.

Optional `network` query: omit or `all` → `p_network_id = NULL`. Otherwise uuid of a seeded network. Unknown id → funnel zeros / not-found for the segment, not a stack trace.

Dashboard MUST show:

- Four KPI regions: approved members, MAM (total + Pathways/LEAD split), pending registrations, content counts (live resources, uncancelled events, current announcements)
- Five funnel stage counts (invitation, registration, approval, first login, 30-day retention). Retention label MUST make “not yet eligible” omitted from the last stage (use `retentionEligible` / `retained` from the snapshot)
- Top 10 live resources with **≥ 3** downloads; top 10 uncancelled events with **≥ 3** Yes RSVPs; rows below that floor are omitted entirely (not shown with a hidden count); **no** forum thread ranking and **no** flag counts

Empty leaderboards: empty state, not an error (including when every live item is below k=3). Opening the page writes **0** new audit action types and **0** product-analytics events.

## Withholding

Unauthorized roles receive the same generic denial as other admin tools — **no** KPI numbers in the body.
