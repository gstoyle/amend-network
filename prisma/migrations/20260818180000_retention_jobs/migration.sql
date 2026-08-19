-- Retention job: GRANT DELETE, split invitations so FOR ALL cannot delete pending,
-- add retention auth_mode policies. Age windows stay in application SQL.

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
  'thread_locked','thread_pinned','user_forum_suspended',
  'directory_privacy_changed','directory_profile_viewed',
  'audit_log_viewed','audit_log_exported','bulk_invite_sent','system_setting_changed',
  'retention_purged'
));

GRANT DELETE ON TABLE audit_log, invitations, password_reset_tokens, sessions TO amend_app;

DROP POLICY IF EXISTS invitations_all ON invitations;

CREATE POLICY invitations_select ON invitations
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR current_setting('app.auth_mode', true) = 'invite_lookup'
  );

CREATE POLICY invitations_insert ON invitations
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR current_setting('app.auth_mode', true) = 'invite_lookup'
  );

CREATE POLICY invitations_update ON invitations
  FOR UPDATE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR current_setting('app.auth_mode', true) = 'invite_lookup'
  )
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR current_setting('app.auth_mode', true) = 'invite_lookup'
  );

CREATE POLICY users_update_retention ON users
  FOR UPDATE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
    AND status = 'deactivated'
  )
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
    AND status = 'deactivated'
  );

CREATE POLICY audit_log_delete_retention ON audit_log
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY invitations_delete_retention ON invitations
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
    AND status IN ('expired', 'revoked')
  );

CREATE POLICY password_reset_tokens_delete_retention ON password_reset_tokens
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY sessions_delete_retention ON sessions
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY directory_listings_delete_retention ON directory_listings
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY directory_shown_titles_delete_retention ON directory_shown_titles
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY directory_shown_docs_delete_retention ON directory_shown_docs
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY directory_shown_emails_delete_retention ON directory_shown_emails
  FOR DELETE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );
