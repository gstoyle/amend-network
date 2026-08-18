-- Staff may remove a join destination on edit. Events and RSVPs stay append/soft-cancel (no DELETE).
GRANT DELETE ON TABLE "event_join_links" TO amend_app;

CREATE POLICY event_join_links_delete ON "event_join_links"
  FOR DELETE TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator'));
