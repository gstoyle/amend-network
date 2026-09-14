-- Extra network memberships so one email can belong to Immersion and LEAD.
-- users.program_role stays the primary programme; user_networks holds all groups.

CREATE TABLE "user_networks" (
    "user_id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_networks_pkey" PRIMARY KEY ("user_id", "network_id")
);

ALTER TABLE "user_networks"
  ADD CONSTRAINT "user_networks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_networks"
  ADD CONSTRAINT "user_networks_network_id_fkey"
  FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_networks" ("user_id", "network_id")
SELECT id, network_id
FROM users
WHERE network_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION sync_user_network_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.network_id IS DISTINCT FROM NEW.network_id AND OLD.network_id IS NOT NULL THEN
    DELETE FROM user_networks
    WHERE user_id = NEW.id
      AND network_id = OLD.network_id;
  END IF;
  IF NEW.network_id IS NOT NULL THEN
    INSERT INTO user_networks (user_id, network_id)
    VALUES (NEW.id, NEW.network_id)
    ON CONFLICT (user_id, network_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_sync_user_network
AFTER INSERT OR UPDATE OF network_id ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_network_membership();

ALTER TABLE "user_networks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_networks" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_networks_select ON "user_networks"
  FOR SELECT TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

DO $owner_policies$
DECLARE
  owner_role text := current_user;
BEGIN
  EXECUTE format(
    'CREATE POLICY user_networks_owner ON user_networks FOR ALL TO %I USING (true) WITH CHECK (true)',
    owner_role
  );
END
$owner_policies$;

GRANT SELECT ON TABLE "user_networks" TO amend_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "user_networks" FROM amend_app;

CREATE OR REPLACE FUNCTION app_member_program_roles()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (
      SELECT array_agg(DISTINCT n.program_role::text)
      FROM user_networks un
      JOIN networks n ON n.id = un.network_id
      WHERE un.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND n.program_role IN ('pathways', 'lead')
    ),
    ARRAY[]::text[]
  );
$$;

REVOKE ALL ON FUNCTION app_member_program_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_member_program_roles() TO amend_app;

CREATE OR REPLACE FUNCTION app_role_tokens()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.status', true) IS DISTINCT FROM 'active' THEN ARRAY[]::text[]
    ELSE ARRAY(
      SELECT DISTINCT token
      FROM unnest(
        ARRAY_REMOVE(ARRAY[
          'all_authenticated',
          CASE current_setting('app.program_role', true)
            WHEN 'pathways' THEN 'pathways'
            WHEN 'lead' THEN 'lead'
            ELSE NULL
          END,
          CASE WHEN current_setting('app.admin_role', true) = 'moderator' THEN 'pathways' END,
          CASE WHEN current_setting('app.admin_role', true) = 'moderator' THEN 'lead' END
        ], NULL) || app_member_program_roles()
      ) AS token
    )
  END;
$$;

CREATE OR REPLACE FUNCTION directory_listing_visible(p_user_id uuid)
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
          AND (
            current_setting('app.program_role', true) = d.program_role::text
            OR d.program_role::text = ANY (app_member_program_roles())
          )
        )
      )
  );
$$;
