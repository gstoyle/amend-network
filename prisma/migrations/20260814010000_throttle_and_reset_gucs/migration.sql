-- Purpose-specific GUCs for lockout and password-reset lookups.
-- Unknown emails have no user_id, so throttle cannot use own-row scope.
-- Reset completion looks up tokens by hash before the user id is known.

DROP POLICY IF EXISTS auth_throttle_all ON "auth_throttle";
CREATE POLICY auth_throttle_all ON "auth_throttle"
  FOR ALL TO amend_app
  USING (current_setting('app.auth_mode', true) = 'throttle')
  WITH CHECK (current_setting('app.auth_mode', true) = 'throttle');

DROP POLICY IF EXISTS password_reset_tokens_all ON "password_reset_tokens";
CREATE POLICY password_reset_tokens_all ON "password_reset_tokens"
  FOR ALL TO amend_app
  USING (
    current_setting('app.auth_mode', true) = 'password_reset'
    OR (
      current_setting('app.user_id', true) <> ''
      AND user_id = current_setting('app.user_id', true)::uuid
    )
  )
  WITH CHECK (
    current_setting('app.auth_mode', true) = 'password_reset'
    OR (
      current_setting('app.user_id', true) <> ''
      AND user_id = current_setting('app.user_id', true)::uuid
    )
  );
