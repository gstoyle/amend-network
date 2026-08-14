-- Join-flow foundation: DOC list, invitations, user PII delta, RLS, invitation_revoked.

CREATE TYPE "JoinSource" AS ENUM ('self_registered', 'invited');
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

CREATE TABLE "doc_affiliations" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    CONSTRAINT "doc_affiliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_affiliations_label_key" ON "doc_affiliations"("label");

CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "email_lookup" BYTEA NOT NULL,
    "email_encrypted" BYTEA NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "inviter_id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "first_name_encrypted" BYTEA NOT NULL,
    "last_name_encrypted" BYTEA NOT NULL,
    "title_encrypted" BYTEA,
    "doc_affiliation_id_encrypted" BYTEA,
    "status" "InvitationStatus" NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "expiry_reminder_sent_at" TIMESTAMPTZ(6),
    "accepted_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");
CREATE INDEX "invitations_email_lookup_idx" ON "invitations"("email_lookup");
CREATE UNIQUE INDEX "invitations_pending_email_lookup_key" ON "invitations"("email_lookup") WHERE "status" = 'pending';

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "title_encrypted" BYTEA;
ALTER TABLE "users" ADD COLUMN "doc_affiliation_id_encrypted" BYTEA;
ALTER TABLE "users" ADD COLUMN "join_source" "JoinSource";
ALTER TABLE "users" ADD COLUMN "registration_ip" INET;
ALTER TABLE "users" ADD COLUMN "denial_reason_encrypted" BYTEA;

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
  'audit_log_viewed','audit_log_exported','bulk_invite_sent','system_setting_changed'
));

ALTER TABLE "doc_affiliations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "doc_affiliations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;

CREATE POLICY doc_affiliations_select ON "doc_affiliations"
  FOR SELECT TO amend_app
  USING (true);

CREATE POLICY doc_affiliations_insert ON "doc_affiliations"
  FOR INSERT TO amend_app
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

CREATE POLICY doc_affiliations_update ON "doc_affiliations"
  FOR UPDATE TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin'))
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

CREATE POLICY invitations_all ON "invitations"
  FOR ALL TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR current_setting('app.auth_mode', true) = 'invite_lookup'
  )
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR current_setting('app.auth_mode', true) = 'invite_lookup'
  );

DROP POLICY IF EXISTS users_select ON "users";
CREATE POLICY users_select ON "users"
  FOR SELECT TO amend_app
  USING (
    current_setting('app.auth_mode', true) = 'credential_lookup'
    OR (
      current_setting('app.user_id', true) <> ''
      AND id = current_setting('app.user_id', true)::uuid
    )
    OR current_setting('app.admin_role', true) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS users_update ON "users";
CREATE POLICY users_update_own ON "users"
  FOR UPDATE TO amend_app
  USING (
    current_setting('app.user_id', true) <> ''
    AND id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.user_id', true) <> ''
    AND id = current_setting('app.user_id', true)::uuid
    AND status::text = current_setting('app.status', true)
    AND program_role::text = current_setting('app.program_role', true)
    AND admin_role::text = current_setting('app.admin_role', true)
  );

CREATE POLICY users_update_admin ON "users"
  FOR UPDATE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND status = 'pending'
  )
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND status IN ('active', 'denied')
  );

-- Registration INSERT: pending member shape only. network_id is NOT constrained
-- to launch networks here (FK to networks if non-null; null allowed). Application
-- validation of Pathways/LEAD belongs in lib/registration (US2), not this WITH CHECK.
CREATE POLICY users_insert_registration ON "users"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.auth_mode', true) = 'registration'
    AND status = 'pending'
    AND program_role = 'none'
    AND admin_role = 'none'
  );

CREATE POLICY users_insert_invite ON "users"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.auth_mode', true) = 'invite_lookup'
    AND status = 'active'
    AND admin_role = 'none'
    AND program_role IN ('pathways', 'lead')
  );

GRANT USAGE ON TYPE "JoinSource" TO amend_app;
GRANT USAGE ON TYPE "InvitationStatus" TO amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE doc_affiliations, invitations TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE doc_affiliations, invitations FROM amend_app;
