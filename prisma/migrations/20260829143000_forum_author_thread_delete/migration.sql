-- Authors may soft-delete their own threads. Staff keep full thread UPDATE.
-- thread_deleted is the audit action for that path.

ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_action_check";
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
  'retention_purged'
));

DROP POLICY forum_threads_select ON "forum_threads";

CREATE POLICY forum_threads_select ON "forum_threads"
  FOR SELECT TO amend_app
  USING (
    forum_is_staff()
    OR author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR (
      deleted_at IS NULL
      AND hidden_at IS NULL
      AND forum_category_visible_core(category_id)
    )
  );

DROP POLICY forum_threads_update ON "forum_threads";

CREATE POLICY forum_threads_update ON "forum_threads"
  FOR UPDATE TO amend_app
  USING (
    forum_is_staff()
    OR (
      current_setting('app.status', true) = 'active'
      AND author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    forum_is_staff()
    OR (
      current_setting('app.status', true) = 'active'
      AND author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

CREATE FUNCTION forum_author_thread_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF forum_is_staff() THEN
    RETURN NEW;
  END IF;
  IF NEW.last_posted_at IS DISTINCT FROM OLD.last_posted_at
     AND NEW.author_id IS NOT DISTINCT FROM OLD.author_id
     AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id
     AND NEW.author_label IS NOT DISTINCT FROM OLD.author_label
     AND NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.pinned IS NOT DISTINCT FROM OLD.pinned
     AND NEW.locked IS NOT DISTINCT FROM OLD.locked
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.hidden_at IS NOT DISTINCT FROM OLD.hidden_at
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.author_label IS DISTINCT FROM OLD.author_label
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.pinned IS DISTINCT FROM OLD.pinned
     OR NEW.locked IS DISTINCT FROM OLD.locked
     OR NEW.last_posted_at IS DISTINCT FROM OLD.last_posted_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'forum_threads: authors may only delete';
  END IF;
  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'forum_threads: authors may only delete';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION forum_author_thread_delete_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION forum_author_thread_delete_guard() TO amend_app;

CREATE TRIGGER forum_author_thread_delete_guard
  BEFORE UPDATE ON "forum_threads"
  FOR EACH ROW
  EXECUTE FUNCTION forum_author_thread_delete_guard();
