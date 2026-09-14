-- Amend vs Members collections, nested folders, and a Policies location tree.
-- Partner Org / External rows become Amend (staff-published = endorsed).

ALTER TABLE resources DROP CONSTRAINT resources_source_label_check;

UPDATE resources
SET source_label = 'Amend'
WHERE source_label IN ('Partner Org', 'External');

ALTER TABLE resources ADD CONSTRAINT resources_source_label_check CHECK (
  source_label IN ('Amend', 'Members')
);

CREATE TABLE resource_folders (
    id UUID NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    parent_id UUID,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resource_folders_pkey PRIMARY KEY (id),
    CONSTRAINT resource_folders_slug_key UNIQUE (slug),
    CONSTRAINT resource_folders_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT resource_folders_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT resource_folders_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES resource_folders(id) ON DELETE RESTRICT
);

CREATE INDEX resource_folders_parent_sort_idx
  ON resource_folders (parent_id, sort_order);

INSERT INTO resource_folders (id, name, slug, parent_id, sort_order)
VALUES (
  'a1111111-1111-4111-8111-111111111111',
  'Policies',
  'policies',
  NULL,
  10
);

INSERT INTO resource_folders (id, name, slug, parent_id, sort_order)
VALUES
  (
    'a1111111-1111-4111-8111-111111111112',
    'Australia',
    'australia',
    'a1111111-1111-4111-8111-111111111111',
    20
  ),
  (
    'a1111111-1111-4111-8111-111111111113',
    'Connecticut',
    'connecticut',
    'a1111111-1111-4111-8111-111111111111',
    30
  ),
  (
    'a1111111-1111-4111-8111-111111111114',
    'Scotland',
    'scotland',
    'a1111111-1111-4111-8111-111111111111',
    40
  ),
  (
    'a1111111-1111-4111-8111-111111111115',
    'Maine',
    'maine',
    'a1111111-1111-4111-8111-111111111111',
    50
  );

ALTER TABLE resources
  ADD COLUMN folder_id UUID,
  ADD CONSTRAINT resources_folder_id_fkey
    FOREIGN KEY (folder_id) REFERENCES resource_folders(id) ON DELETE RESTRICT;

CREATE INDEX resources_folder_id_idx ON resources (folder_id);

CREATE OR REPLACE FUNCTION resources_resource_download_guard()
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
     OR NEW.folder_id IS DISTINCT FROM OLD.folder_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  THEN
    RAISE EXCEPTION 'resources: resource_download may not change columns other than download_count';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION resource_folder_has_visible_resource(p_folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM resources r
    WHERE r.deleted_at IS NULL
      AND r.visibility && app_role_tokens()
      AND (
        r.folder_id = p_folder_id
        OR r.folder_id IN (
          SELECT child.id FROM resource_folders child WHERE child.parent_id = p_folder_id
        )
      )
  );
$$;

ALTER TABLE resource_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_folders FORCE ROW LEVEL SECURITY;

CREATE POLICY resource_folders_select ON resource_folders
  FOR SELECT TO amend_app
  USING (
    current_setting('app.admin_role', true) IN ('admin', 'super_admin')
    OR resource_folder_has_visible_resource(id)
  );

CREATE POLICY resource_folders_insert ON resource_folders
  FOR INSERT TO amend_app
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

CREATE POLICY resource_folders_update ON resource_folders
  FOR UPDATE TO amend_app
  USING (current_setting('app.admin_role', true) IN ('admin', 'super_admin'))
  WITH CHECK (current_setting('app.admin_role', true) IN ('admin', 'super_admin'));

DO $owner_policy$
DECLARE
  owner_role text := current_user;
BEGIN
  EXECUTE format(
    'CREATE POLICY resource_folders_owner ON resource_folders FOR ALL TO %I USING (true) WITH CHECK (true)',
    owner_role
  );
END
$owner_policy$;

GRANT SELECT, INSERT, UPDATE ON TABLE resource_folders TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE resource_folders FROM amend_app;
GRANT EXECUTE ON FUNCTION resource_folder_has_visible_resource(uuid) TO amend_app;
