-- Count Yes RSVPs for capacity without exposing other members' RSVP rows to member SELECT.
CREATE FUNCTION event_yes_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN event_visible_core(p_event_id) THEN (
      SELECT COUNT(*)::integer
      FROM event_rsvps r
      WHERE r.event_id = p_event_id
        AND r.status = 'yes'
    )
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION event_yes_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_yes_count(uuid) TO amend_app;
