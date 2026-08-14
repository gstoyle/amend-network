# RLS policy contract (delta)

Runtime role remains `amend_app` (no `BYPASSRLS`). Migrator `amend_owner`. Transaction-local GUCs from `002-auth-rbac`, plus:

| GUC | New values |
| --- | --- |
| `app.auth_mode` | existing: `credential_lookup`, `session_lookup`, `throttle`, `password_reset`. **Add:** `registration`, `invite_lookup`. |

Extend `RlsContext.authMode` in `lib/db/rls.ts` only (do not add a second RLS helper).

`pnpm test:rls` sets GUCs and queries **without** `requireRole`.

## doc_affiliations (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- `SELECT` to `amend_app`: `true` (labels are vocabulary)
- `INSERT` / `UPDATE`: `app.admin_role IN ('admin', 'super_admin')`
- No `DELETE` policy; `REVOKE DELETE, TRUNCATE` from `amend_app`

## invitations (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- `SELECT` / `INSERT` / `UPDATE`: `app.admin_role IN ('admin', 'super_admin')` **OR** `app.auth_mode = 'invite_lookup'`
- No `DELETE`; revoke is a status update
- `invite_lookup` is only used by server helpers that query `token_hash` (unique). Tests must still prove Moderator GUCs cannot SELECT invitations.

## users (changed)

Keep `credential_lookup` and own-row SELECT.

**Add SELECT**: `app.admin_role IN ('admin', 'super_admin')` (pending queue + invite duplicate check). Moderator MUST NOT match.

**Add INSERT**:

- `auth_mode = 'registration'` WITH CHECK `status = 'pending' AND program_role = 'none' AND admin_role = 'none'`
- `auth_mode = 'invite_lookup'` WITH CHECK `status = 'active' AND admin_role = 'none' AND program_role IN ('pathways', 'lead')`

**Change UPDATE** (closes self-activation):

- Own row: `id = app.user_id` AND WITH CHECK that `status`, `program_role`, `admin_role` are unchanged
- Admin/Super Admin: may UPDATE rows currently `pending` to `active` or `denied` (approval/denial)

## networks

Unchanged: `SELECT` true; no writes for `amend_app`.

## Grants

`GRANT SELECT, INSERT, UPDATE` on `doc_affiliations`, `invitations` to `amend_app`. `REVOKE DELETE` on both. Sequence grants if any.

## Extra RLS assertions (`pnpm test:rls`)

| Actor GUCs | Must fail |
| --- | --- |
| moderator / pathways / lead / pending | SELECT other users’ pending PII; SELECT invitations; INSERT/UPDATE `doc_affiliations`; UPDATE a pending user to `active` |
| pending own row | UPDATE own `status` to `active` |
| anonymous (`registration` mode) | INSERT user with `admin_role = admin` or `status = active` |
| invite_lookup | INSERT user with `admin_role ≠ none` |

| Actor GUCs | Must succeed |
| --- | --- |
| admin / super_admin | SELECT pending users; INSERT/UPDATE affiliations; INSERT pending invitations |
| registration mode | INSERT a pending member-shaped user |
| invite_lookup | SELECT invitation by `token_hash`; INSERT active member-shaped user |
