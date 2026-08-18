-- Read-only dashboard aggregates. Does not ALTER existing tables or audit_log RLS.
-- k=3 is hardcoded (not a parameter). See specs/009-admin-analytics/research.md §6a.

CREATE FUNCTION admin_analytics_snapshot(p_network_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF current_setting('app.admin_role', true) NOT IN ('admin', 'super_admin') THEN
    RETURN '{}'::jsonb;
  END IF;

  WITH month_start AS (
    SELECT (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS start_at
  ),
  approved_members AS (
    SELECT u.id, u.program_role, u.network_id
    FROM users u
    WHERE u.status = 'active'
      AND u.program_role IN ('pathways', 'lead')
  ),
  mam_ids AS (
    SELECT DISTINCT u.id, u.program_role
    FROM audit_log a
    CROSS JOIN month_start m
    JOIN users u ON u.id = a.actor_user_id
    WHERE a.action = 'login_success'
      AND a.created_at >= m.start_at
      AND a.created_at < m.start_at + interval '1 month'
      AND u.status = 'active'
      AND u.program_role IN ('pathways', 'lead')
      AND (p_network_id IS NULL OR u.network_id = p_network_id)
  ),
  registration_set AS (
    SELECT u.id, u.status, u.join_source, u.created_at, u.network_id
    FROM users u
    WHERE u.join_source IS NOT NULL
      AND (p_network_id IS NULL OR u.network_id = p_network_id)
  ),
  approval_set AS (
    SELECT r.*
    FROM registration_set r
    WHERE r.join_source = 'invited'
       OR (r.join_source = 'self_registered' AND r.status IN ('active', 'deactivated'))
  ),
  approval_times AS (
    SELECT
      a.id,
      CASE
        WHEN a.join_source = 'invited' THEN a.created_at
        ELSE (
          SELECT min(al.created_at)
          FROM audit_log al
          WHERE al.action = 'registration_approved'
            AND al.target_user_id = a.id
        )
      END AS approved_at
    FROM approval_set a
  ),
  first_logins AS (
    SELECT
      t.id,
      min(l.created_at) AS first_login_at
    FROM approval_times t
    JOIN audit_log l
      ON l.actor_user_id = t.id
     AND l.action = 'login_success'
     AND t.approved_at IS NOT NULL
     AND l.created_at >= t.approved_at
    GROUP BY t.id
  ),
  top_resources AS (
    SELECT r.id, r.title, r.download_count
    FROM resources r
    WHERE r.deleted_at IS NULL
      AND r.download_count >= 3
    ORDER BY r.download_count DESC, r.title ASC
    LIMIT 10
  ),
  top_events AS (
    SELECT e.id, e.title, count(*)::int AS yes_count
    FROM events e
    JOIN event_rsvps rv ON rv.event_id = e.id AND rv.status = 'yes'
    WHERE e.cancelled_at IS NULL
    GROUP BY e.id, e.title
    HAVING count(*) >= 3
    ORDER BY count(*) DESC, e.title ASC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'approvedMembers', (SELECT count(*)::int FROM approved_members),
      'mam', (SELECT count(*)::int FROM mam_ids),
      'mamPathways', (SELECT count(*)::int FROM mam_ids WHERE program_role = 'pathways'),
      'mamLead', (SELECT count(*)::int FROM mam_ids WHERE program_role = 'lead'),
      'pendingRegistrations', (SELECT count(*)::int FROM users WHERE status = 'pending'),
      'liveResources', (SELECT count(*)::int FROM resources WHERE deleted_at IS NULL),
      'uncancelledEvents', (SELECT count(*)::int FROM events WHERE cancelled_at IS NULL),
      'currentAnnouncements', (SELECT count(*)::int FROM announcements WHERE deleted_at IS NULL)
    ),
    'funnel', jsonb_build_object(
      'invitation', (
        SELECT count(*)::int FROM invitations i
        WHERE p_network_id IS NULL OR i.network_id = p_network_id
      ),
      'registration', (SELECT count(*)::int FROM registration_set),
      'approval', (SELECT count(*)::int FROM approval_set),
      'firstLogin', (SELECT count(*)::int FROM first_logins),
      'retentionEligible', (
        SELECT count(*)::int FROM first_logins
        WHERE first_login_at <= now() - interval '30 days'
      ),
      'retained', (
        SELECT count(*)::int FROM first_logins f
        WHERE f.first_login_at <= now() - interval '30 days'
          AND EXISTS (
            SELECT 1 FROM audit_log l
            WHERE l.actor_user_id = f.id
              AND l.action = 'login_success'
              AND l.created_at > f.first_login_at
              AND l.created_at <= f.first_login_at + interval '30 days'
          )
      )
    ),
    'topResources', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', tr.id,
            'title', tr.title,
            'downloadCount', tr.download_count
          )
          ORDER BY tr.download_count DESC, tr.title ASC
        )
        FROM top_resources tr
      ),
      '[]'::jsonb
    ),
    'topEvents', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', te.id,
            'title', te.title,
            'yesCount', te.yes_count
          )
          ORDER BY te.yes_count DESC, te.title ASC
        )
        FROM top_events te
      ),
      '[]'::jsonb
    )
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION admin_analytics_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_analytics_snapshot(uuid) TO amend_app;
