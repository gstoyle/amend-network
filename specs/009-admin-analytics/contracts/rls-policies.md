# RLS policy contract (delta)

Runtime role remains `amend_app` (no `BYPASSRLS`). Migrator `amend_owner`. Transaction-local GUCs from `002`–`007` are **unchanged**. **No new `app.auth_mode` value.**

`app_role_tokens()` is **unchanged**.

`audit_log` SELECT/INSERT policies are **unchanged** (Super Admin all rows; Admin last 90 days; others none; no UPDATE/DELETE).

`users_select`, invitations, resources, events, announcements policies are **unchanged**.

`pnpm test:rls` sets GUCs and queries **without** `requireRole`.

## Dashboard snapshot (one function — do not duplicate)

```sql
CREATE FUNCTION admin_analytics_snapshot(p_network_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_setting('app.admin_role', true) NOT IN ('admin', 'super_admin') THEN
    RETURN '{}'::jsonb;
  END IF;
  -- aggregate only; never RETURN query of audit_log rows
  ...
END;
$$;

REVOKE ALL ON FUNCTION admin_analytics_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_analytics_snapshot(uuid) TO amend_app;
```

`SECURITY DEFINER` is required so inner `audit_log` reads for first-login / retention / MAM are not clipped by Admin’s 90-day SELECT, while **direct** `SELECT` on `audit_log` stays clipped. Session GUCs still decide who may receive JSON. The function MUST NOT return trail rows, ciphertext, names, emails, DOC, IP, or user-agent.

Payload shape: [data-model.md](../data-model.md). Stage definitions: [research.md](../research.md) §3. Leaderboards: omit count < 3 entirely, then `LIMIT 10` ([research.md](../research.md) §6a). k is **not** a function parameter.

## audit_log (no delta)

Assert in the standalone RLS file: as Admin, `SELECT` from `audit_log` where `created_at < now() - interval '90 days'` returns **0** rows in a fixture that the snapshot still used for retention counts.

## Direct EXECUTE `admin_analytics_snapshot`

As `amend_app` with GUCs only (no `requireRole`):

| Caller `app.admin_role` | `admin_analytics_snapshot(NULL)` |
| --- | --- |
| `super_admin` | JSON with `kpis` / `funnel` keys; numbers match Admin |
| `admin` | **Same JSON numbers** as Super Admin on the same fixture, including identical `topResources` / `topEvents` after k=3 omission |
| `moderator` / `none` (Pathways, LEAD, pending) | `{}` or missing `kpis` — **0** usable counts |

Also: live resource with 1–2 downloads and uncancelled event with 1–2 Yes MUST NOT appear in the JSON arrays (no id, no title, no zeroed count). Count ≥ 3 MAY appear. `jsonb_array_length(topEvents)` ≤ 10.

Do not test this via `lib/admin-analytics`. Use raw `SELECT admin_analytics_snapshot($1)`.
