-- Member directory: user privacy flags, projection tables, directory_listing_visible, leave-active purge.

ALTER TABLE "users"
  ADD COLUMN "directory_visible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "directory_show_title" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "directory_show_doc_affiliation" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "directory_show_email" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "directory_privacy_set_at" TIMESTAMPTZ(6);

CREATE TABLE "directory_listings" (
    "user_id" UUID NOT NULL,
    "program_role" "ProgramRole" NOT NULL,
    "network_id" UUID NOT NULL,
    "first_name_encrypted" BYTEA NOT NULL,
    "last_name_encrypted" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "directory_listings_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "directory_listings_program_role_check" CHECK (program_role IN ('pathways', 'lead'))
);

CREATE TABLE "directory_shown_titles" (
    "user_id" UUID NOT NULL,
    "title_encrypted" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "directory_shown_titles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "directory_shown_docs" (
    "user_id" UUID NOT NULL,
    "doc_affiliation_id_encrypted" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "directory_shown_docs_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "directory_shown_emails" (
    "user_id" UUID NOT NULL,
    "email_encrypted" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "directory_shown_emails_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "directory_search_throttle" (
    "user_id" UUID NOT NULL,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "search_count" INTEGER NOT NULL,
    CONSTRAINT "directory_search_throttle_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "directory_search_throttle_count_check" CHECK (search_count >= 0 AND search_count <= 30)
);

CREATE FUNCTION directory_listing_visible(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM directory_listings d
    JOIN users u ON u.id = d.user_id
    WHERE d.user_id = p_user_id
      AND u.status = 'active'
      AND u.program_role IN ('pathways', 'lead')
      AND (
        current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator')
        OR (
          current_setting('app.status', true) = 'active'
          AND current_setting('app.program_role', true) = d.program_role::text
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION directory_listing_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION directory_listing_visible(uuid) TO amend_app;

CREATE FUNCTION directory_purge_on_leave_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status IS DISTINCT FROM 'active' THEN
    DELETE FROM directory_shown_titles WHERE user_id = NEW.id;
    DELETE FROM directory_shown_docs WHERE user_id = NEW.id;
    DELETE FROM directory_shown_emails WHERE user_id = NEW.id;
    DELETE FROM directory_listings WHERE user_id = NEW.id;
    UPDATE users
      SET directory_visible = false
      WHERE id = NEW.id
        AND directory_visible IS DISTINCT FROM false;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION directory_purge_on_leave_active() FROM PUBLIC;

CREATE TRIGGER directory_purge_on_leave_active
  AFTER UPDATE OF status ON users
  FOR EACH ROW
  EXECUTE FUNCTION directory_purge_on_leave_active();

ALTER TABLE "directory_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "directory_listings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "directory_shown_titles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "directory_shown_titles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "directory_shown_docs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "directory_shown_docs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "directory_shown_emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "directory_shown_emails" FORCE ROW LEVEL SECURITY;
ALTER TABLE "directory_search_throttle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "directory_search_throttle" FORCE ROW LEVEL SECURITY;

CREATE POLICY directory_listings_select ON "directory_listings"
  FOR SELECT TO amend_app
  USING (directory_listing_visible(user_id));

CREATE POLICY directory_listings_insert ON "directory_listings"
  FOR INSERT TO amend_app
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_listings_update ON "directory_listings"
  FOR UPDATE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_listings_delete ON "directory_listings"
  FOR DELETE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_titles_select ON "directory_shown_titles"
  FOR SELECT TO amend_app
  USING (directory_listing_visible(user_id));

CREATE POLICY directory_shown_titles_insert ON "directory_shown_titles"
  FOR INSERT TO amend_app
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_titles_update ON "directory_shown_titles"
  FOR UPDATE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_titles_delete ON "directory_shown_titles"
  FOR DELETE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_docs_select ON "directory_shown_docs"
  FOR SELECT TO amend_app
  USING (directory_listing_visible(user_id));

CREATE POLICY directory_shown_docs_insert ON "directory_shown_docs"
  FOR INSERT TO amend_app
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_docs_update ON "directory_shown_docs"
  FOR UPDATE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_docs_delete ON "directory_shown_docs"
  FOR DELETE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_emails_select ON "directory_shown_emails"
  FOR SELECT TO amend_app
  USING (directory_listing_visible(user_id));

CREATE POLICY directory_shown_emails_insert ON "directory_shown_emails"
  FOR INSERT TO amend_app
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_emails_update ON "directory_shown_emails"
  FOR UPDATE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_shown_emails_delete ON "directory_shown_emails"
  FOR DELETE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_search_throttle_select ON "directory_search_throttle"
  FOR SELECT TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_search_throttle_insert ON "directory_search_throttle"
  FOR INSERT TO amend_app
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY directory_search_throttle_update ON "directory_search_throttle"
  FOR UPDATE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "directory_listings" TO amend_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "directory_shown_titles" TO amend_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "directory_shown_docs" TO amend_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "directory_shown_emails" TO amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "directory_search_throttle" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "directory_search_throttle" FROM amend_app;
