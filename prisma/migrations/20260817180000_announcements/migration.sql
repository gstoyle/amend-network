-- Announcement banners: tables, announcement_visible_core, native RLS, grants.

CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta_primary_label" TEXT,
    "cta_primary_url" TEXT,
    "cta_secondary_label" TEXT,
    "cta_secondary_url" TEXT,
    "activates_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "visibility" TEXT[] NOT NULL,
    "dismissible" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "announcements_headline_check" CHECK (char_length(btrim(headline)) BETWEEN 1 AND 120),
    CONSTRAINT "announcements_body_check" CHECK (char_length(body) BETWEEN 1 AND 1000),
    CONSTRAINT "announcements_window_check" CHECK (expires_at > activates_at),
    CONSTRAINT "announcements_visibility_check" CHECK (
      visibility <@ ARRAY['all_authenticated', 'pathways', 'lead']::text[]
      AND cardinality(visibility) >= 1
    ),
    CONSTRAINT "announcements_cta_primary_check" CHECK (
      (cta_primary_label IS NULL AND cta_primary_url IS NULL)
      OR (
        cta_primary_label IS NOT NULL AND cta_primary_url IS NOT NULL
        AND char_length(btrim(cta_primary_label)) BETWEEN 1 AND 40
      )
    ),
    CONSTRAINT "announcements_cta_secondary_check" CHECK (
      (cta_secondary_label IS NULL AND cta_secondary_url IS NULL)
      OR (
        cta_primary_label IS NOT NULL
        AND cta_secondary_label IS NOT NULL AND cta_secondary_url IS NOT NULL
        AND char_length(btrim(cta_secondary_label)) BETWEEN 1 AND 40
      )
    )
);

CREATE INDEX "announcements_visibility_idx" ON "announcements" USING GIN ("visibility");
CREATE INDEX "announcements_activates_at_idx" ON "announcements" ("activates_at");

CREATE TABLE "announcement_dismissals" (
    "user_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "dismissed_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "announcement_dismissals_pkey" PRIMARY KEY ("user_id", "announcement_id"),
    CONSTRAINT "announcement_dismissals_announcement_id_fkey"
      FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE RESTRICT
);

CREATE TABLE "announcement_impressions" (
    "user_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "announcement_impressions_pkey" PRIMARY KEY ("user_id", "announcement_id"),
    CONSTRAINT "announcement_impressions_announcement_id_fkey"
      FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE RESTRICT
);

CREATE TABLE "announcement_cta_clicks" (
    "user_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "slot" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "announcement_cta_clicks_pkey" PRIMARY KEY ("user_id", "announcement_id"),
    CONSTRAINT "announcement_cta_clicks_slot_check" CHECK (slot IN ('primary', 'secondary')),
    CONSTRAINT "announcement_cta_clicks_announcement_id_fkey"
      FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE RESTRICT
);

CREATE FUNCTION announcement_visible_core(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM announcements a
    WHERE a.id = p_announcement_id
      AND a.deleted_at IS NULL
      AND now() >= a.activates_at
      AND now() <= a.expires_at
      AND a.visibility && app_role_tokens()
  );
$$;

GRANT EXECUTE ON FUNCTION announcement_visible_core(uuid) TO amend_app;

ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "announcement_dismissals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcement_dismissals" FORCE ROW LEVEL SECURITY;
ALTER TABLE "announcement_impressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcement_impressions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "announcement_cta_clicks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcement_cta_clicks" FORCE ROW LEVEL SECURITY;

CREATE POLICY announcements_select ON "announcements"
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR (
      announcement_visible_core(id)
      AND NOT EXISTS (
        SELECT 1 FROM announcement_dismissals d
        WHERE d.announcement_id = announcements.id
          AND d.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
  );

CREATE POLICY announcements_insert ON "announcements"
  FOR INSERT TO amend_app
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

CREATE POLICY announcements_update ON "announcements"
  FOR UPDATE TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin'))
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

CREATE POLICY announcement_dismissals_select ON "announcement_dismissals"
  FOR SELECT TO amend_app
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR current_setting('app.admin_role', true) IN ('admin', 'super_admin')
  );

CREATE POLICY announcement_dismissals_insert ON "announcement_dismissals"
  FOR INSERT TO amend_app
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND announcement_visible_core(announcement_id)
    AND (SELECT a.dismissible FROM announcements a WHERE a.id = announcement_id)
  );

CREATE POLICY announcement_impressions_select ON "announcement_impressions"
  FOR SELECT TO amend_app
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR current_setting('app.admin_role', true) IN ('admin', 'super_admin')
  );

CREATE POLICY announcement_impressions_insert ON "announcement_impressions"
  FOR INSERT TO amend_app
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND announcement_visible_core(announcement_id)
    AND NOT EXISTS (
      SELECT 1 FROM announcement_dismissals d
      WHERE d.announcement_id = announcement_impressions.announcement_id
        AND d.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

CREATE POLICY announcement_cta_clicks_select ON "announcement_cta_clicks"
  FOR SELECT TO amend_app
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR current_setting('app.admin_role', true) IN ('admin', 'super_admin')
  );

CREATE POLICY announcement_cta_clicks_insert ON "announcement_cta_clicks"
  FOR INSERT TO amend_app
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND announcement_visible_core(announcement_id)
    AND NOT EXISTS (
      SELECT 1 FROM announcement_dismissals d
      WHERE d.announcement_id = announcement_cta_clicks.announcement_id
        AND d.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE "announcements" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "announcements" FROM amend_app;
GRANT SELECT, INSERT ON TABLE "announcement_dismissals" TO amend_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "announcement_dismissals" FROM amend_app;
GRANT SELECT, INSERT ON TABLE "announcement_impressions" TO amend_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "announcement_impressions" FROM amend_app;
GRANT SELECT, INSERT ON TABLE "announcement_cta_clicks" TO amend_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "announcement_cta_clicks" FROM amend_app;
