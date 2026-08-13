# RLS policy contract

Runtime role: `amend_app` (no `BYPASSRLS`). Migrator: `amend_owner`.

Transaction-local settings (third `set_config` argument true):

| GUC | Example |
| --- | --- |
| `app.user_id` | uuid |
| `app.program_role` | `pathways` \| `lead` \| `none` |
| `app.admin_role` | `super_admin` \| `admin` \| `moderator` \| `none` |
| `app.status` | `pending` \| `active` \| `deactivated` \| `denied` |

SQL function `app_role_tokens()` returns `text[]`:

- empty if `app.status` is not `active` (pending/denied/deactivated see no visibility rows)
- `all_authenticated` if status is `active`
- `pathways` / `lead` from `app.program_role`
- if `app.admin_role = moderator`, also both `pathways` and `lead`

## visibility_records

- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- `SELECT` using `visibility && app_role_tokens()`
- no `INSERT`/`UPDATE`/`DELETE` for `amend_app`

GIN index on `visibility`.

## audit_log

- INSERT for `amend_app`
- SELECT using: `app.admin_role = 'super_admin'` OR (`app.admin_role = 'admin'` AND `created_at >= now() - interval '90 days'`)
- UPDATE/DELETE/TRUNCATE revoked from `amend_app`

## sessions / users / password_reset_tokens / auth_throttle

RLS enabled. Users may SELECT/UPDATE **own** session rows (revoke). Password reset and throttle accessed only through server helpers running as `amend_app` with GUCs; policies must not leak other users’ rows. Owner role used only in migrations and seed.

`pnpm test:rls` sets GUCs and SELECTs `visibility_records` / `audit_log` with **no** `requireRole` in process.
