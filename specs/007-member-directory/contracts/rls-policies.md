# RLS policy contract (delta)

Runtime role remains `amend_app` (no `BYPASSRLS`). Migrator `amend_owner`. Transaction-local GUCs from `002`–`006` are **unchanged**. **No new `app.auth_mode` value.**

`app_role_tokens()` is **unchanged**.

`users_select` is **unchanged**. Pathways / LEAD / Moderator still cannot `SELECT` other `users` rows.

`pnpm test:rls` sets GUCs and queries **without** `requireRole`.

## Shared listing core (one function — do not duplicate)

Active subject + listing row + (staff OR same `program_role`) lives in **one** SQL function. Policies **call** this function. They MUST NOT paste those predicates again.

```sql
CREATE FUNCTION directory_listing_visible(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM directory_listings d
    JOIN users u ON u.id = d.user_id
    WHERE d.user_id = p_user_id
      AND u.status = 'active'
      AND u.program_role IN ('pathways', 'lead')
      AND (
        current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator')
        OR (
          current_setting('app.status', true) = 'active'
          AND current_setting('app.program_role', true) = d.program_role::text
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION directory_listing_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION directory_listing_visible(uuid) TO amend_app;
```

`SECURITY DEFINER` is required so the inner `users` join does not re-enter `users` RLS. Session GUCs still drive staff vs same-program. Direct `EXECUTE` MUST return false for other-program, pending viewer, deactivated subject, and missing ids (same as missing). The function MUST NOT return names, ciphertext, or labels — boolean only.

## directory_listings

RLS enabled + FORCE. `GRANT SELECT, INSERT, UPDATE, DELETE` to `amend_app`.

| Command | Policy |
| --- | --- |
| SELECT | `directory_listing_visible(user_id)` |
| INSERT / UPDATE / DELETE | `user_id = current_setting('app.user_id')::uuid` (own listing only; no staff override) |

## directory_shown_titles / directory_shown_docs / directory_shown_emails

RLS enabled + FORCE. Same grants.

| Command | Policy |
| --- | --- |
| SELECT | `directory_listing_visible(user_id)` |
| INSERT / UPDATE / DELETE | own `user_id` only |

If title is hidden, **no row** — SELECT cannot return title ciphertext.

## directory_search_throttle

RLS enabled + FORCE.

| Command | Policy |
| --- | --- |
| SELECT / INSERT / UPDATE | `user_id = current_setting('app.user_id')::uuid` |
| DELETE | none; `REVOKE DELETE` |

## users (no delta)

Assert in the standalone RLS file: as Pathways, `SELECT` from `users` where `id <> app.user_id` returns **0** rows.

## Direct EXECUTE `directory_listing_visible`

`/speckit-tasks` MUST emit a **standalone** fail-first file `tests/rls/directory-listing-visible.test.ts`. Caller is `amend_app`. GUCs: Pathways member, not staff. **Not** through `lib/directory`.

| Case | Setup | Expect |
| --- | --- | --- |
| Same program | Opted-in Active Pathways listing | `EXECUTE` → true; `SELECT` listings → 1 row; `SELECT` users other rows → 0 |
| Cross program | Opted-in Active LEAD listing | `EXECUTE` → false; `SELECT` listings → 0; same as missing id |
| Deactivated | Pathways listing + shown-email row, then `users.status = deactivated` (owner UPDATE) | `EXECUTE` → false; `SELECT` listings → 0; `SELECT directory_shown_emails` for that id → **0 rows** (deleted, not merely unread) |
| Hidden title | Same-program peer with title hidden | `SELECT directory_shown_titles` for that `user_id` → 0 rows |
| Pending viewer | `app.status = pending` | `EXECUTE` on a live Pathways listing → false |

Helper-path search tests do **not** satisfy this file.
