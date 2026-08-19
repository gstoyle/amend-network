-- Postgres also applies SELECT policies when evaluating DELETE/UPDATE.
-- Admin audit SELECT is 90 days, so 7-year retention DELETE would match 0 rows
-- without a retention SELECT. Directory/session/reset SELECT is not admin-wide.

CREATE POLICY audit_log_select_retention ON audit_log
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY password_reset_tokens_select_retention ON password_reset_tokens
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY sessions_select_retention ON sessions
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY directory_listings_select_retention ON directory_listings
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY directory_shown_titles_select_retention ON directory_shown_titles
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY directory_shown_docs_select_retention ON directory_shown_docs
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );

CREATE POLICY directory_shown_emails_select_retention ON directory_shown_emails
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    AND current_setting('app.auth_mode', true) = 'retention'
  );
