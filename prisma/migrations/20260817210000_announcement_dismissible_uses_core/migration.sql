CREATE OR REPLACE FUNCTION announcement_dismissible(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT announcement_visible_core(p_announcement_id)
     AND EXISTS (
       SELECT 1
       FROM announcements a
       WHERE a.id = p_announcement_id
         AND a.dismissible
     );
$$;
