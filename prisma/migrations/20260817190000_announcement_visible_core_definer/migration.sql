-- announcement_visible_core reads announcements. Without SECURITY DEFINER that
-- SELECT re-enters announcements RLS and overflows the stack.
CREATE OR REPLACE FUNCTION announcement_visible_core(p_announcement_id uuid)
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
