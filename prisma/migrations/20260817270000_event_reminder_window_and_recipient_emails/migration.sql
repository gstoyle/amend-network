-- Bind reminder stamps to the same (now, now+24h] window as runEventReminders.
-- 2-arg calls still work (p_now defaults to CURRENT_TIMESTAMP).
DROP FUNCTION IF EXISTS event_mark_reminder_sent(uuid, uuid);

CREATE FUNCTION event_mark_reminder_sent(
  p_event_id uuid,
  p_user_id uuid,
  p_now timestamptz DEFAULT CURRENT_TIMESTAMP
)
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
        AND e.starts_at > p_now
        AND e.starts_at <= p_now + interval '24 hours'
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION event_mark_reminder_sent(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_mark_reminder_sent(uuid, uuid, timestamptz) TO amend_app;

-- Recipient emails for one event's RSVPs (every current status: FR-017/FR-018).
-- Staff GUC required. Does not open a session that can SELECT all users/rsvps.
CREATE FUNCTION event_rsvp_recipient_emails(p_event_id uuid)
RETURNS TABLE(email_encrypted bytea)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_setting('app.admin_role', true) NOT IN ('admin', 'super_admin', 'moderator') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.email_encrypted
  FROM event_rsvps r
  JOIN users u ON u.id = r.user_id
  WHERE r.event_id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION event_rsvp_recipient_emails(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_rsvp_recipient_emails(uuid) TO amend_app;
