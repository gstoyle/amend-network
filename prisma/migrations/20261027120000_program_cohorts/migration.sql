-- Programme cohorts (specs/014-program-cohorts). A `networks` row is a cohort.
-- Members of a cohort carry the visibility token `cohort:<network id>` in
-- addition to their programme token. Moderators carry every cohort token;
-- Admin and Super Admin keep their existing policy bypass.
-- Every statement is re-runnable: scripts/render.mjs retries this migration
-- after a partial failure.

ALTER TABLE "networks" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);

-- Visibility format: fixed tokens or `cohort:<uuid>`. Arrays cannot carry a
-- foreign key, so existence and "active for new targets" are checked by the
-- application inside the write transaction. A dangling cohort token matches
-- no member, so it fails closed.
CREATE OR REPLACE FUNCTION visibility_tokens_valid(p_tokens text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_tokens, ARRAY[]::text[])) AS t(token)
    WHERE token IS NULL
      OR NOT (
        token IN ('all_authenticated', 'pathways', 'lead')
        OR token ~ '^cohort:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION visibility_tokens_valid(text[]) TO amend_app;

ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_visibility_check";
ALTER TABLE "resources" ADD CONSTRAINT "resources_visibility_check"
  CHECK (visibility_tokens_valid(visibility));

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_visibility_check";
ALTER TABLE "events" ADD CONSTRAINT "events_visibility_check"
  CHECK (visibility_tokens_valid(visibility));

ALTER TABLE "announcements" DROP CONSTRAINT IF EXISTS "announcements_visibility_check";
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_visibility_check"
  CHECK (visibility_tokens_valid(visibility));

ALTER TABLE "forum_categories" DROP CONSTRAINT IF EXISTS "forum_categories_visibility_check";
ALTER TABLE "forum_categories" ADD CONSTRAINT "forum_categories_visibility_check"
  CHECK (visibility_tokens_valid(visibility));

CREATE OR REPLACE FUNCTION app_member_cohort_tokens()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    CASE
      WHEN current_setting('app.admin_role', true) = 'moderator' THEN (
        SELECT array_agg('cohort:' || n.id::text)
        FROM networks n
        WHERE n.program_role IN ('pathways', 'lead')
      )
      ELSE (
        SELECT array_agg('cohort:' || un.network_id::text)
        FROM user_networks un
        JOIN networks n ON n.id = un.network_id
        WHERE un.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
          AND n.program_role IN ('pathways', 'lead')
      )
    END,
    ARRAY[]::text[]
  );
$$;

REVOKE ALL ON FUNCTION app_member_cohort_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_member_cohort_tokens() TO amend_app;

CREATE OR REPLACE FUNCTION app_role_tokens()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.status', true) IS DISTINCT FROM 'active' THEN ARRAY[]::text[]
    ELSE ARRAY(
      SELECT DISTINCT token
      FROM unnest(
        ARRAY_REMOVE(ARRAY[
          'all_authenticated',
          CASE current_setting('app.program_role', true)
            WHEN 'pathways' THEN 'pathways'
            WHEN 'lead' THEN 'lead'
            ELSE NULL
          END,
          CASE WHEN current_setting('app.admin_role', true) = 'moderator' THEN 'pathways' END,
          CASE WHEN current_setting('app.admin_role', true) = 'moderator' THEN 'lead' END
        ], NULL) || app_member_program_roles() || app_member_cohort_tokens()
      ) AS token
    )
  END;
$$;

ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_action_check";
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_action_check" CHECK ("action" IN (
  'login_success','login_failure','password_reset_requested','password_reset_completed',
  'mfa_enrolled','mfa_challenge_failed','session_revoked','logout',
  'invitation_sent','invitation_accepted','invitation_expired','invitation_revoked','registration_submitted',
  'registration_approved','registration_denied','account_deactivated','account_reactivated',
  'account_hard_deleted','role_assigned','role_changed',
  'resource_created','resource_edited','resource_deleted','resource_downloaded',
  'event_created','event_edited','event_cancelled','event_rsvp',
  'announcement_created','announcement_edited','announcement_deleted',
  'post_created','post_edited','post_flagged','post_hidden','post_deleted',
  'thread_locked','thread_pinned','thread_deleted','user_forum_suspended',
  'directory_privacy_changed','directory_profile_viewed',
  'audit_log_viewed','audit_log_exported','bulk_invite_sent','system_setting_changed',
  'retention_purged',
  'cohort_created','cohort_renamed','cohort_archived','cohort_unarchived',
  'cohort_member_added','cohort_member_removed'
));

-- Cohort lifecycle: Admin and Super Admin only. No DELETE grant; archive instead.
GRANT INSERT, UPDATE ON TABLE "networks" TO amend_app;

DROP POLICY IF EXISTS networks_insert_admin ON "networks";
CREATE POLICY networks_insert_admin ON "networks"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND program_role IN ('pathways', 'lead')
  );

DROP POLICY IF EXISTS networks_update_admin ON "networks";
CREATE POLICY networks_update_admin ON "networks"
  FOR UPDATE TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin'))
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND program_role IN ('pathways', 'lead')
  );

CREATE OR REPLACE FUNCTION networks_program_role_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.program_role IS DISTINCT FROM OLD.program_role THEN
    RAISE EXCEPTION 'networks: program_role cannot change';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS networks_program_role_immutable ON "networks";
CREATE TRIGGER networks_program_role_immutable
  BEFORE UPDATE ON "networks"
  FOR EACH ROW
  EXECUTE FUNCTION networks_program_role_immutable();

-- Cohort memberships: Admin and Super Admin add and remove extra cohorts.
CREATE OR REPLACE FUNCTION user_network_target_eligible(p_user_id uuid, p_network_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u, networks n
    WHERE u.id = p_user_id
      AND n.id = p_network_id
      AND u.program_role <> 'none'
      AND n.program_role IN ('pathways', 'lead')
      AND n.archived_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION user_network_target_eligible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_network_target_eligible(uuid, uuid) TO amend_app;

GRANT INSERT, DELETE ON TABLE "user_networks" TO amend_app;

DROP POLICY IF EXISTS user_networks_select_admin ON "user_networks";
CREATE POLICY user_networks_select_admin ON "user_networks"
  FOR SELECT TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS user_networks_insert_admin ON "user_networks";
CREATE POLICY user_networks_insert_admin ON "user_networks"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND user_network_target_eligible(user_id, network_id)
  );

DROP POLICY IF EXISTS user_networks_delete_admin ON "user_networks";
CREATE POLICY user_networks_delete_admin ON "user_networks"
  FOR DELETE TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

-- The primary cohort (users.network_id) is removed only by changing
-- users.network_id, which the sync trigger handles after the update.
CREATE OR REPLACE FUNCTION user_networks_primary_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = OLD.user_id
      AND u.network_id = OLD.network_id
  ) THEN
    RAISE EXCEPTION 'user_networks: primary cohort cannot be removed';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION user_networks_primary_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS user_networks_primary_guard ON "user_networks";
CREATE TRIGGER user_networks_primary_guard
  BEFORE DELETE ON "user_networks"
  FOR EACH ROW
  EXECUTE FUNCTION user_networks_primary_guard();
