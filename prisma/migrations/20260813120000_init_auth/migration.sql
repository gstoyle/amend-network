-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProgramRole" AS ENUM ('pathways', 'lead', 'none');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'admin', 'moderator', 'none');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'active', 'deactivated', 'denied');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('info', 'warning', 'security');

-- CreateTable
CREATE TABLE "networks" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "program_role" "ProgramRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email_lookup" BYTEA NOT NULL,
    "email_encrypted" BYTEA NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name_encrypted" BYTEA,
    "last_name_encrypted" BYTEA,
    "network_id" UUID,
    "program_role" "ProgramRole" NOT NULL,
    "admin_role" "AdminRole" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "mfa_secret_encrypted" BYTEA,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "user_agent" TEXT NOT NULL,
    "ip" INET NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "mfa_satisfied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_throttle" (
    "id" UUID NOT NULL,
    "identifier_hash" BYTEA NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "locked_until" TIMESTAMPTZ(6),

    CONSTRAINT "auth_throttle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "target_user_id" UUID,
    "ip" INET NOT NULL,
    "user_agent" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "severity" "AuditSeverity" NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_records" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "visibility" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visibility_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "networks_name_key" ON "networks"("name");
CREATE UNIQUE INDEX "users_email_lookup_key" ON "users"("email_lookup");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE UNIQUE INDEX "auth_throttle_identifier_hash_key" ON "auth_throttle"("identifier_hash");
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");
CREATE INDEX "visibility_records_visibility_idx" ON "visibility_records" USING GIN ("visibility");

ALTER TABLE "users" ADD CONSTRAINT "users_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_action_check" CHECK ("action" IN (
  'login_success','login_failure','password_reset_requested','password_reset_completed',
  'mfa_enrolled','mfa_challenge_failed','session_revoked','logout',
  'invitation_sent','invitation_accepted','invitation_expired','registration_submitted',
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

CREATE OR REPLACE FUNCTION app_role_tokens()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.status', true) IS DISTINCT FROM 'active' THEN ARRAY[]::text[]
    ELSE ARRAY_REMOVE(ARRAY[
      'all_authenticated',
      CASE current_setting('app.program_role', true)
        WHEN 'pathways' THEN 'pathways'
        WHEN 'lead' THEN 'lead'
        ELSE NULL
      END,
      CASE WHEN current_setting('app.admin_role', true) = 'moderator' THEN 'pathways' END,
      CASE WHEN current_setting('app.admin_role', true) = 'moderator' THEN 'lead' END
    ], NULL)
  END;
$$;

ALTER TABLE "visibility_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visibility_records" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" FORCE ROW LEVEL SECURITY;
ALTER TABLE "auth_throttle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_throttle" FORCE ROW LEVEL SECURITY;
ALTER TABLE "networks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "networks" FORCE ROW LEVEL SECURITY;

CREATE POLICY visibility_records_select ON "visibility_records"
  FOR SELECT TO amend_app
  USING (visibility && app_role_tokens());

CREATE POLICY audit_log_insert ON "audit_log"
  FOR INSERT TO amend_app
  WITH CHECK (true);

CREATE POLICY audit_log_select ON "audit_log"
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) = 'super_admin'
    OR (
      current_setting('app.admin_role', true) = 'admin'
      AND created_at >= now() - interval '90 days'
    )
  );

CREATE POLICY users_select ON "users"
  FOR SELECT TO amend_app
  USING (
    current_setting('app.auth_mode', true) = 'credential_check'
    OR (
      current_setting('app.user_id', true) <> ''
      AND id = current_setting('app.user_id', true)::uuid
    )
  );

CREATE POLICY users_update ON "users"
  FOR UPDATE TO amend_app
  USING (
    current_setting('app.user_id', true) <> ''
    AND id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.user_id', true) <> ''
    AND id = current_setting('app.user_id', true)::uuid
  );

CREATE POLICY sessions_all ON "sessions"
  FOR ALL TO amend_app
  USING (
    current_setting('app.auth_mode', true) = 'credential_check'
    OR (
      current_setting('app.user_id', true) <> ''
      AND user_id = current_setting('app.user_id', true)::uuid
    )
  )
  WITH CHECK (
    current_setting('app.auth_mode', true) = 'credential_check'
    OR (
      current_setting('app.user_id', true) <> ''
      AND user_id = current_setting('app.user_id', true)::uuid
    )
  );

CREATE POLICY password_reset_tokens_all ON "password_reset_tokens"
  FOR ALL TO amend_app
  USING (current_setting('app.auth_mode', true) = 'credential_check')
  WITH CHECK (current_setting('app.auth_mode', true) = 'credential_check');

CREATE POLICY auth_throttle_all ON "auth_throttle"
  FOR ALL TO amend_app
  USING (current_setting('app.auth_mode', true) = 'credential_check')
  WITH CHECK (current_setting('app.auth_mode', true) = 'credential_check');

CREATE POLICY networks_select ON "networks"
  FOR SELECT TO amend_app
  USING (true);

GRANT USAGE ON SCHEMA public TO amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE users, sessions, password_reset_tokens, auth_throttle TO amend_app;
GRANT SELECT ON TABLE networks, visibility_records TO amend_app;
GRANT INSERT, SELECT ON TABLE audit_log TO amend_app;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO amend_app;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM amend_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE visibility_records FROM amend_app;
