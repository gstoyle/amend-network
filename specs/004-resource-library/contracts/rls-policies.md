# RLS policy contract (delta)

Runtime role remains `amend_app` (no `BYPASSRLS`). Migrator `amend_owner`. Transaction-local GUCs from `002-auth-rbac` / `003`, plus:

| GUC | New values |
| --- | --- |
| `app.auth_mode` | **Add:** `resource_download`. Existing values unchanged. |

Extend `RlsContext.authMode` in `lib/db/rls.ts` only.

`app_role_tokens()` is **unchanged** (pending → empty; active → `all_authenticated` + program; moderator adds both programs).

`pnpm test:rls` sets GUCs and queries **without** `requireRole`.

## resources (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- GIN index on `visibility`
- Check: visibility subset of `{all_authenticated, pathways, lead}`, cardinality ≥ 1
- Check: `source_label IN ('Amend','Partner Org','External')`
- Check: `cardinality(tags) <= 10`

| Command | USING / WITH CHECK |
| --- | --- |
| SELECT | `(visibility && app_role_tokens() AND deleted_at IS NULL)` **OR** `app.admin_role IN ('admin','super_admin')` |
| INSERT | `app.admin_role IN ('admin','super_admin')` |
| UPDATE | Split below. RLS decides **who** may update. The download-mode **shape** (`download_count = OLD + 1`, every other column frozen) is **RLS-RES-UPD-DL**, a `BEFORE UPDATE` trigger — not WITH CHECK prose. |
| DELETE | none |

### UPDATE policy (RLS — who)

`WITH CHECK` on UPDATE sees only the **new** row. It MUST NOT be used to express `OLD + 1` (no OLD; a same-table subquery is not a reliable OLD snapshot). Admin updates are unrestricted in shape (still admin-only). Download-mode USING/WITH CHECK only require live + visible:

```sql
CREATE POLICY resources_update ON resources
  FOR UPDATE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR (
      current_setting('app.auth_mode', true) = 'resource_download'
      AND deleted_at IS NULL
      AND visibility && app_role_tokens()
    )
  )
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR (
      current_setting('app.auth_mode', true) = 'resource_download'
      AND deleted_at IS NULL
      AND visibility && app_role_tokens()
    )
  );
```

### Download-mode row shape (**RLS-RES-UPD-DL** — BEFORE UPDATE trigger)

**Pick:** `BEFORE UPDATE FOR EACH ROW` trigger on `resources`. `OLD` / `NEW` are the comparison. Not a WITH CHECK subquery.

When `app.auth_mode` is **not** `resource_download`, the trigger returns `NEW` (admin metadata/replace/soft-delete). When it **is** `resource_download`, the statement MUST fail unless:

1. `NEW.download_count IS NOT DISTINCT FROM OLD.download_count + 1`
2. **Every other column** is unchanged (`IS NOT DISTINCT FROM OLD`): `id`, `title`, `preview_text`, `thumbnail_object_key`, `source_label`, `tags`, `file_object_key`, `file_size_bytes`, `file_mime_type`, `visibility`, `uploaded_by`, `created_at`, `updated_at`, `deleted_at`

If a later migration adds a column to `resources`, this trigger MUST be updated in the same migration so the new column is frozen under `resource_download`.

```sql
CREATE FUNCTION resources_resource_download_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.auth_mode', true) IS DISTINCT FROM 'resource_download' THEN
    RETURN NEW;
  END IF;

  IF NEW.download_count IS DISTINCT FROM OLD.download_count + 1 THEN
    RAISE EXCEPTION 'resources: resource_download may only increment download_count by 1';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.preview_text IS DISTINCT FROM OLD.preview_text
     OR NEW.thumbnail_object_key IS DISTINCT FROM OLD.thumbnail_object_key
     OR NEW.source_label IS DISTINCT FROM OLD.source_label
     OR NEW.tags IS DISTINCT FROM OLD.tags
     OR NEW.file_object_key IS DISTINCT FROM OLD.file_object_key
     OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
     OR NEW.file_mime_type IS DISTINCT FROM OLD.file_mime_type
     OR NEW.visibility IS DISTINCT FROM OLD.visibility
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  THEN
    RAISE EXCEPTION 'resources: resource_download may not change columns other than download_count';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER resources_resource_download_guard
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION resources_resource_download_guard();
```

`amend_owner` bypasses RLS, not this trigger. Seed and admin updates must not set `app.auth_mode = 'resource_download'`.

**Traceability:** Requirement **RLS-RES-UPD-DL** is implemented by **T008** (migration: trigger + UPDATE policy together) and proven by **T005** (`tests/rls/resources-policies.test.ts`: `+1` succeeds; `+2` / `+0` / other-column changes fail). T028 is the only production `authMode: "resource_download"` call site. Do not leave +1 as application-only.

`GRANT SELECT, INSERT, UPDATE` on `resources` to `amend_app`. `REVOKE DELETE, TRUNCATE`.

## visibility_records / users / audit_log

Unchanged. Keep the 002 fixture table.

## Extra RLS assertions (`pnpm test:rls`)

| Actor GUCs | Must fail |
| --- | --- |
| pending / denied / deactivated / empty tokens | SELECT any live resource |
| pathways | SELECT `lead`-only live row; SELECT withdrawn row |
| lead | SELECT `pathways`-only live row |
| moderator | SELECT withdrawn row; INSERT/UPDATE metadata; soft-delete |
| pathways / lead / moderator | INSERT resource; UPDATE keys; SET `deleted_at` |
| pathways with `resource_download` | UPDATE a `lead`-only row’s `download_count` |
| pathways with `resource_download` | Change **any** non-count column on a visible row (`title`, `preview_text`, `tags`, `file_mime_type`, `file_object_key`, `deleted_at`, `updated_at`, …) |
| pathways with `resource_download` | Set `download_count` to old+2, old+0, or old−1 |

| Actor GUCs | Must succeed |
| --- | --- |
| pathways | SELECT `all_authenticated` and `pathways` live rows |
| lead | SELECT `all_authenticated` and `lead` live rows |
| moderator | SELECT live rows of every visibility (not withdrawn) |
| admin / super_admin | SELECT live **and** withdrawn of every visibility; INSERT; UPDATE metadata; set `deleted_at` |
| pathways + `resource_download` | Increment `download_count` on a visible live row by 1 |
