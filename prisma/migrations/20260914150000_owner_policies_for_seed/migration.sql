-- Render's migrate role is not a superuser and cannot BYPASSRLS. FORCE RLS
-- therefore blocks seed (and other owner writes) on tables that only have
-- amend_app policies. Same pattern as 20260828033000_forum_definer_row_security:
-- give the table owner an explicit ALL policy. amend_app still uses its own.

DO $owner_policies$
DECLARE
  owner_role text := current_user;
  tbl text;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_owner', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO %I USING (true) WITH CHECK (true)',
      tbl || '_owner',
      tbl,
      owner_role
    );
  END LOOP;
END
$owner_policies$;
