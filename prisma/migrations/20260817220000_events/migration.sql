-- Events: tables, event_visible_core, event_join_revealed, event_promote_oldest_waitlist, native RLS, grants.

CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "timezone_hint" TEXT,
    "location" TEXT,
    "is_virtual" BOOLEAN NOT NULL DEFAULT FALSE,
    "capacity" INTEGER,
    "visibility" TEXT[] NOT NULL,
    "host_user_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    CONSTRAINT "events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "events_title_check" CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
    CONSTRAINT "events_description_check" CHECK (char_length(description) BETWEEN 1 AND 5000),
    CONSTRAINT "events_location_check" CHECK (location IS NULL OR char_length(location) BETWEEN 1 AND 200),
    CONSTRAINT "events_window_check" CHECK (ends_at > starts_at),
    CONSTRAINT "events_capacity_check" CHECK (capacity IS NULL OR capacity >= 1),
    CONSTRAINT "events_visibility_check" CHECK (
      visibility <@ ARRAY['all_authenticated', 'pathways', 'lead']::text[]
      AND cardinality(visibility) >= 1
    )
);

CREATE INDEX "events_visibility_idx" ON "events" USING GIN ("visibility");
CREATE INDEX "events_starts_at_idx" ON "events" ("starts_at");

CREATE TABLE "event_join_links" (
    "event_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "event_join_links_pkey" PRIMARY KEY ("event_id"),
    CONSTRAINT "event_join_links_url_check" CHECK (url ~* '^https?://'),
    CONSTRAINT "event_join_links_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT
);

CREATE TABLE "event_rsvps" (
    "user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "waitlisted_at" TIMESTAMPTZ(6),
    "reminder_sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("user_id", "event_id"),
    CONSTRAINT "event_rsvps_status_check" CHECK (status IN ('yes', 'no', 'maybe', 'waitlist')),
    CONSTRAINT "event_rsvps_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT
);

CREATE FUNCTION event_visible_core(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM events e
    WHERE e.id = p_event_id
      AND e.cancelled_at IS NULL
      AND e.visibility && app_role_tokens()
  );
$$;

REVOKE ALL ON FUNCTION event_visible_core(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_visible_core(uuid) TO amend_app;

CREATE FUNCTION event_join_revealed(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT event_visible_core(p_event_id)
     AND EXISTS (
       SELECT 1
       FROM event_rsvps r
       WHERE r.event_id = p_event_id
         AND r.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND r.status = 'yes'
     )
     AND EXISTS (
       SELECT 1
       FROM events e
       WHERE e.id = p_event_id
         AND now() >= e.starts_at - interval '1 hour'
         AND now() <= e.ends_at
     );
$$;

REVOKE ALL ON FUNCTION event_join_revealed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_join_revealed(uuid) TO amend_app;

CREATE FUNCTION event_promote_oldest_waitlist(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  promoted_user uuid;
  yes_count integer;
  cap integer;
BEGIN
  IF NOT event_visible_core(p_event_id) THEN
    RETURN NULL;
  END IF;

  PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;

  SELECT e.capacity INTO cap FROM events e WHERE e.id = p_event_id;
  SELECT COUNT(*)::integer INTO yes_count
  FROM event_rsvps r
  WHERE r.event_id = p_event_id AND r.status = 'yes';

  IF cap IS NOT NULL AND yes_count >= cap THEN
    RETURN NULL;
  END IF;

  UPDATE event_rsvps
  SET
    status = 'yes',
    waitlisted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE event_id = p_event_id
    AND user_id = (
      SELECT r.user_id
      FROM event_rsvps r
      WHERE r.event_id = p_event_id
        AND r.status = 'waitlist'
      ORDER BY r.waitlisted_at ASC NULLS LAST, r.user_id ASC
      LIMIT 1
    )
    AND status = 'waitlist'
  RETURNING user_id INTO promoted_user;

  RETURN promoted_user;
END;
$$;

REVOKE ALL ON FUNCTION event_promote_oldest_waitlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_promote_oldest_waitlist(uuid) TO amend_app;

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "event_join_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_join_links" FORCE ROW LEVEL SECURITY;
ALTER TABLE "event_rsvps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_rsvps" FORCE ROW LEVEL SECURITY;

CREATE POLICY events_select ON "events"
  FOR SELECT TO amend_app
  USING (
    event_visible_core(id)
    OR current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator')
  );

CREATE POLICY events_insert ON "events"
  FOR INSERT TO amend_app
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator'));

CREATE POLICY events_update ON "events"
  FOR UPDATE TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator'))
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator'));

CREATE POLICY event_join_links_select ON "event_join_links"
  FOR SELECT TO amend_app
  USING (
    event_join_revealed(event_id)
    OR current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator')
  );

CREATE POLICY event_join_links_insert ON "event_join_links"
  FOR INSERT TO amend_app
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator'));

CREATE POLICY event_join_links_update ON "event_join_links"
  FOR UPDATE TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator'))
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator'));

CREATE POLICY event_rsvps_select ON "event_rsvps"
  FOR SELECT TO amend_app
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator')
  );

CREATE POLICY event_rsvps_insert ON "event_rsvps"
  FOR INSERT TO amend_app
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND event_visible_core(event_id)
  );

CREATE POLICY event_rsvps_update ON "event_rsvps"
  FOR UPDATE TO amend_app
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND event_visible_core(event_id)
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND event_visible_core(event_id)
  );

GRANT SELECT, INSERT, UPDATE ON TABLE "events" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "events" FROM amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "event_join_links" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "event_join_links" FROM amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "event_rsvps" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "event_rsvps" FROM amend_app;
