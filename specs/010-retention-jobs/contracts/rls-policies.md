# RLS policy contract (delta)

Runtime role remains `amend_app` (no `BYPASSRLS`). Migrator `amend_owner`. Existing GUCs from `002`–`009` stay. **New** `app.auth_mode` value: `retention` (job only; never an HTTP handler).

`pnpm test:rls` sets GUCs and issues SQL **without** `requireRole` and **without** `runRetentionJob`.

## `app.auth_mode`

`withRls` must accept `authMode: "retention"` and `set_config('app.auth_mode', 'retention', true)` like `password_reset` / `invite_lookup`.

## GRANTs

```sql
GRANT DELETE ON TABLE audit_log, invitations, password_reset_tokens, sessions TO amend_app;
```

Directory tables already have DELETE. `users` stays UPDATE-only (no user DELETE).

## New policies

```sql
-- Users: anonymize deactivated rows only; cannot change status
CREATE POLICY users_update_retention ON users
  FOR UPDATE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
    AND status = 'deactivated'
  )
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
    AND status = 'deactivated'
  );

CREATE POLICY audit_log_delete_retention ON audit_log
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY invitations_delete_retention ON invitations
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
    AND status IN ('expired', 'revoked')
  );

CREATE POLICY password_reset_tokens_delete_retention ON password_reset_tokens
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY sessions_delete_retention ON sessions
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );
```

For each directory table that already has owner-only DELETE, **add** an OR policy (do not replace owner DELETE):

```sql
CREATE POLICY directory_listings_delete_retention ON directory_listings
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );
```

Same pattern: `directory_shown_titles`, `directory_shown_docs`, `directory_shown_emails` (and throttle if that table should be cleared).

**Age predicates are not in RLS** — they use injected `now` in the job’s `WHERE` ([research.md](./research.md) §2).

## Unchanged (must still hold)

- `audit_log` SELECT: Super Admin all; Admin 90 days; others none. **No UPDATE** policy.
- `audit_log` INSERT: still allowed (job writes `retention_purged` with `writeAudit`).
- `users_update_admin`: still pending-only approve/deny.
- Invitation sweep still uses `admin` **without** `retention` (UPDATE to expired only).

## Direct SQL assertions (`tests/rls/retention-policies.test.ts`)

Required standalone file. Cite this contract.

1. As Pathways (`admin_role` empty, `auth_mode` empty): `DELETE FROM audit_log` → 0; `DELETE FROM invitations` → 0.
2. As Admin, `auth_mode` empty: `DELETE FROM audit_log` → 0; `UPDATE users SET first_name_encrypted = $1 WHERE status = 'deactivated'` → 0.
3. As Admin + `auth_mode = retention`: can DELETE a fixture security row with `created_at` in the past (job will still apply 7y in app; RLS allows the delete); cannot `UPDATE users SET status = 'active' WHERE status = 'deactivated'` (WITH CHECK fail); cannot `DELETE` a **pending** invitation.
4. As Admin + `retention`: `UPDATE` deactivated user ciphertext **keeping** `status = deactivated` succeeds (anonymize path).
5. **Single production call site (explicit):** Recursively read `lib/`, `app/`, and `scripts/` (`.ts` / `.tsx`). Count matches of `/authMode:\s*["']retention["']/`. Expect **exactly 1**, in the file that exports `runRetentionJob` (not in `lib/db/rls.ts` union, not in `scripts/run-retention.ts`). Policy cases in this file set `app.auth_mode` with raw `set_config`, so this test file itself is not a product call site.

`requireRole` is not imported in this file.
