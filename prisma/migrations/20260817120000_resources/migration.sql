-- Resource library: table, checks, GIN, native RLS, grants, and RLS-RES-UPD-DL trigger.

CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "preview_text" TEXT NOT NULL,
    "thumbnail_object_key" TEXT NOT NULL,
    "source_label" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "file_object_key" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "file_mime_type" TEXT NOT NULL,
    "visibility" TEXT[] NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "resources_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "resources_title_check" CHECK (char_length(btrim(title)) >= 1),
    CONSTRAINT "resources_preview_text_check" CHECK (char_length(preview_text) BETWEEN 1 AND 500),
    CONSTRAINT "resources_source_label_check" CHECK (source_label IN ('Amend', 'Partner Org', 'External')),
    CONSTRAINT "resources_tags_cardinality_check" CHECK (cardinality(tags) <= 10),
    CONSTRAINT "resources_file_size_bytes_check" CHECK (file_size_bytes BETWEEN 1 AND 262144000),
    CONSTRAINT "resources_file_mime_type_check" CHECK (file_mime_type IN (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'video/mp4'
    )),
    CONSTRAINT "resources_visibility_check" CHECK (
      visibility <@ ARRAY['all_authenticated', 'pathways', 'lead']::text[]
      AND cardinality(visibility) >= 1
    ),
    CONSTRAINT "resources_download_count_check" CHECK (download_count >= 0)
);

CREATE INDEX "resources_visibility_idx" ON "resources" USING GIN ("visibility");

ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resources" FORCE ROW LEVEL SECURITY;

CREATE POLICY resources_select ON "resources"
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR (
      deleted_at IS NULL
      AND visibility && app_role_tokens()
    )
  );

CREATE POLICY resources_insert ON "resources"
  FOR INSERT TO amend_app
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

CREATE POLICY resources_update ON "resources"
  FOR UPDATE TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR (
      current_setting('app.auth_mode', true) = 'resource_download'
      AND deleted_at IS NULL
      AND visibility && app_role_tokens()
    )
  )
  WITH CHECK (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR (
      current_setting('app.auth_mode', true) = 'resource_download'
      AND deleted_at IS NULL
      AND visibility && app_role_tokens()
    )
  );

-- RLS-RES-UPD-DL: BEFORE UPDATE trigger (WITH CHECK cannot see OLD).
CREATE FUNCTION resources_resource_download_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.auth_mode', true) IS DISTINCT FROM 'resource_download' THEN
    RETURN NEW;
  END IF;

  IF NEW.download_count IS DISTINCT FROM OLD.download_count + 1 THEN
    RAISE EXCEPTION 'resources: resource_download may only increment download_count by 1';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.preview_text IS DISTINCT FROM OLD.preview_text
     OR NEW.thumbnail_object_key IS DISTINCT FROM OLD.thumbnail_object_key
     OR NEW.source_label IS DISTINCT FROM OLD.source_label
     OR NEW.tags IS DISTINCT FROM OLD.tags
     OR NEW.file_object_key IS DISTINCT FROM OLD.file_object_key
     OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
     OR NEW.file_mime_type IS DISTINCT FROM OLD.file_mime_type
     OR NEW.visibility IS DISTINCT FROM OLD.visibility
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  THEN
    RAISE EXCEPTION 'resources: resource_download may not change columns other than download_count';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER resources_resource_download_guard
  BEFORE UPDATE ON "resources"
  FOR EACH ROW
  EXECUTE FUNCTION resources_resource_download_guard();

GRANT SELECT, INSERT, UPDATE ON TABLE "resources" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "resources" FROM amend_app;
GRANT EXECUTE ON FUNCTION resources_resource_download_guard() TO amend_app;
