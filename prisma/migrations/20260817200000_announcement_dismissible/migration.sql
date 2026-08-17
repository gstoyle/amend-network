CREATE OR REPLACE FUNCTION announcement_dismissible(p_announcement_id uuid)
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
      AND a.dismissible
  );
$$;

REVOKE ALL ON FUNCTION announcement_dismissible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION announcement_dismissible(uuid) TO amend_app;

DROP POLICY announcement_dismissals_insert ON announcement_dismissals;
CREATE POLICY announcement_dismissals_insert ON "announcement_dismissals"
  FOR INSERT TO amend_app
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND announcement_visible_core(announcement_id)
    AND announcement_dismissible(announcement_id)
  );
