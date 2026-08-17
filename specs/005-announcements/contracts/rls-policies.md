# RLS policy contract (delta)

Runtime role remains `amend_app` (no `BYPASSRLS`). Migrator `amend_owner`. Transaction-local GUCs from `002-auth-rbac` / `003` / `004` are **unchanged**. **No new `app.auth_mode` value.**

`app_role_tokens()` is **unchanged** (pending → empty; active → `all_authenticated` + program; moderator adds both programs).

`pnpm test:rls` sets GUCs and queries **without** `requireRole`.

## Shared visibility core (one function — do not duplicate)

Window + not withdrawn + `visibility && app_role_tokens()` lives in **one** SQL function. Policies **call** this function. They MUST NOT paste those three predicates again.

```sql
CREATE FUNCTION announcement_visible_core(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM announcements a
    WHERE a.id = p_announcement_id
      AND a.deleted_at IS NULL
      AND now() >= a.activates_at
      AND now() <= a.expires_at
      AND a.visibility && app_role_tokens()
  );
$$;

REVOKE ALL ON FUNCTION announcement_visible_core(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION announcement_visible_core(uuid) TO amend_app;
```

`SECURITY DEFINER` is required: the function reads `announcements`, and member SELECT RLS calls the function. Without definer rights (owner `BYPASSRLS`) that inner SELECT re-enters the same policy and overflows the stack. Session GUCs still drive `app_role_tokens()`. Do not grant execute to `PUBLIC`.

Wrappers (still not a second copy of the core):

| Use | Expression |
| --- | --- |
| Member **SELECT** on `announcements` | `announcement_visible_core(id) AND NOT EXISTS (own dismissal)` **OR** admin |
| Dismiss **INSERT** | own `user_id` **AND** `announcement_visible_core(announcement_id)` **AND** `announcement_dismissible(announcement_id)` — **no** `NOT EXISTS` dismissal (first insert must succeed; repeats are `ON CONFLICT DO NOTHING` in the helper). `announcement_dismissible` is `SECURITY DEFINER` and **calls** `announcement_visible_core` (plus `dismissible`); it must not paste window / withdrawn / `app_role_tokens()` again. Direct `EXECUTE` therefore returns false for rows the caller cannot see. |
| Click / impress **INSERT** | own `user_id` **AND** the same SELECT-equivalent check: `announcement_visible_core(announcement_id) AND NOT EXISTS (own dismissal)` |

Own dismissal subquery (used only where the table above says so):

```sql
NOT EXISTS (
  SELECT 1 FROM announcement_dismissals d
  WHERE d.announcement_id = <announcement id>
    AND d.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
)
```

The two-banner cap is **not** a policy (see research §1–2). Tests still assert the helper returns at most two, ordered by `activates_at DESC, id DESC`.

## announcements (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- GIN index on `visibility`
- Index on `activates_at`
- Check: visibility subset of `{all_authenticated, pathways, lead}`, cardinality ≥ 1
- Check: `expires_at > activates_at`
- Check: CTA pairing (primary both-or-neither; secondary both-or-neither; secondary ⇒ primary)

| Command | USING / WITH CHECK |
| --- | --- |
| SELECT | `announcement_visible_core(id) AND NOT EXISTS (own dismissal)` **OR** `app.admin_role IN ('admin','super_admin')` |
| INSERT | `app.admin_role IN ('admin','super_admin')` |
| UPDATE | `app.admin_role IN ('admin','super_admin')` |
| DELETE | none |

`GRANT SELECT, INSERT, UPDATE` on `announcements` to `amend_app`. `REVOKE DELETE, TRUNCATE`.

## announcement_dismissals (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- PK `(user_id, announcement_id)`
- FK `announcement_id → announcements(id)` (ON DELETE restrict — withdraw is soft)

| Command | USING / WITH CHECK |
| --- | --- |
| SELECT | `user_id = current_setting('app.user_id')::uuid` **OR** admin/super_admin |
| INSERT | `user_id = current_setting('app.user_id')::uuid` **AND** `announcement_visible_core(announcement_id)` **AND** `announcement_dismissible(announcement_id)` — **no** `NOT EXISTS` dismissal |
| UPDATE | none |
| DELETE | none |

`GRANT SELECT, INSERT` to `amend_app`. `REVOKE UPDATE, DELETE, TRUNCATE`.

## announcement_impressions / announcement_cta_clicks (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- PK `(user_id, announcement_id)`
- Clicks: check `slot IN ('primary','secondary')`

| Command | USING / WITH CHECK |
| --- | --- |
| SELECT | own `user_id` **OR** admin/super_admin |
| INSERT | own `user_id` **AND** `announcement_visible_core(announcement_id) AND NOT EXISTS (own dismissal)` (same as member SELECT) |
| UPDATE / DELETE | none |

`GRANT SELECT, INSERT` to `amend_app`. `REVOKE UPDATE, DELETE, TRUNCATE`.

## visibility_records / resources / users / audit_log

Unchanged.

## Extra RLS assertions (`pnpm test:rls`)

| Actor GUCs | Must fail |
| --- | --- |
| pending / denied / deactivated / empty tokens | SELECT any live announcement |
| pathways | SELECT `lead`-only live in-window row; SELECT withdrawn; SELECT scheduled; SELECT expired |
| lead | SELECT `pathways`-only live in-window row |
| pathways (after own dismissal) | SELECT that announcement |
| moderator | INSERT/UPDATE announcement; withdraw; INSERT dismissal for another user_id |
| pathways / lead / moderator | INSERT announcement; SET `deleted_at`; change another user’s dismissal |
| pathways | INSERT dismissal for a `lead`-only or out-of-window id |
| pathways / empty tokens (direct `EXECUTE`) | `announcement_dismissible(lead-only or withdrawn id)` is false |

| Actor GUCs | Must succeed |
| --- | --- |
| pathways | SELECT `all_authenticated` and `pathways` live in-window, not dismissed |
| lead | SELECT `all_authenticated` and `lead` live in-window, not dismissed |
| moderator | SELECT live in-window rows of every visibility (not withdrawn/scheduled/expired) |
| admin / super_admin | SELECT live, scheduled, expired, withdrawn of every visibility; INSERT; UPDATE; set `deleted_at` |
| pathways | INSERT own dismissal on a dismissible visible live row |
| pathways | INSERT own impression/click uniqueness row for a visible live banner |
