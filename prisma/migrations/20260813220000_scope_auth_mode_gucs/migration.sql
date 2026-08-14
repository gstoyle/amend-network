-- Scope pre-identity lookups: replace the single credential_check bypass
-- with purpose-specific modes. password_reset_tokens and auth_throttle have
-- no wide-open branch for any mode that exists today.

DROP POLICY IF EXISTS users_select ON "users";
CREATE POLICY users_select ON "users"
  FOR SELECT TO amend_app
  USING (
    current_setting('app.auth_mode', true) = 'credential_lookup'
    OR (
      current_setting('app.user_id', true) <> ''
      AND id = current_setting('app.user_id', true)::uuid
    )
  );

DROP POLICY IF EXISTS sessions_all ON "sessions";
CREATE POLICY sessions_all ON "sessions"
  FOR ALL TO amend_app
  USING (
    current_setting('app.auth_mode', true) = 'session_lookup'
    OR (
      current_setting('app.user_id', true) <> ''
      AND user_id = current_setting('app.user_id', true)::uuid
    )
  )
  WITH CHECK (
    current_setting('app.auth_mode', true) = 'session_lookup'
    OR (
      current_setting('app.user_id', true) <> ''
      AND user_id = current_setting('app.user_id', true)::uuid
    )
  );

DROP POLICY IF EXISTS password_reset_tokens_all ON "password_reset_tokens";
CREATE POLICY password_reset_tokens_all ON "password_reset_tokens"
  FOR ALL TO amend_app
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS auth_throttle_all ON "auth_throttle";
CREATE POLICY auth_throttle_all ON "auth_throttle"
  FOR ALL TO amend_app
  USING (false)
  WITH CHECK (false);
