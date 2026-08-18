-- Mark a Yes RSVP reminder as sent. Members cannot UPDATE another user's RSVP row.
CREATE FUNCTION event_mark_reminder_sent(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_setting('app.admin_role', true) NOT IN ('admin', 'super_admin', 'moderator') THEN
    RETURN false;
  END IF;

  UPDATE event_rsvps
  SET
    reminder_sent_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE event_id = p_event_id
    AND user_id = p_user_id
    AND status = 'yes'
    AND reminder_sent_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM events e
      WHERE e.id = p_event_id
        AND e.cancelled_at IS NULL
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION event_mark_reminder_sent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_mark_reminder_sent(uuid, uuid) TO amend_app;
