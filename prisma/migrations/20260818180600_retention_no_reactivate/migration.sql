-- Permissive UPDATE policies OR their WITH CHECK expressions. users_update_admin
-- WITH CHECK allows status IN ('active','denied'), which would accept a
-- retention USING hit that sets deactivated → active. Restrictive lock: under
-- auth_mode=retention the new row must stay deactivated.

CREATE POLICY users_update_retention_no_reactivate ON users
  AS RESTRICTIVE
  FOR UPDATE TO amend_app
  WITH CHECK (
    current_setting('app.auth_mode', true) IS DISTINCT FROM 'retention'
    OR status = 'deactivated'
  );
