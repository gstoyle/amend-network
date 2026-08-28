-- Render's migrate role is not a superuser and cannot BYPASSRLS. FORCE RLS
-- therefore hides forum rows from SECURITY DEFINER helpers (and the bump
-- trigger), so the first post after a thread insert fails.
--
-- SET row_security = off is not a bypass: it errors when a policy would apply
-- (42501 check_enable_rls). Give the table owner explicit policies instead.
-- amend_app still uses its own policies.

CREATE OR REPLACE FUNCTION forum_category_visible_core(p_category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM forum_categories c
    WHERE c.id = p_category_id
      AND c.visibility && app_role_tokens()
  );
$$;

CREATE OR REPLACE FUNCTION forum_thread_member_visible(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM forum_threads t
    WHERE t.id = p_thread_id
      AND t.deleted_at IS NULL
      AND t.hidden_at IS NULL
      AND forum_category_visible_core(t.category_id)
  );
$$;

CREATE OR REPLACE FUNCTION forum_thread_writable(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM forum_threads t
    WHERE t.id = p_thread_id
      AND t.deleted_at IS NULL
      AND t.hidden_at IS NULL
      AND t.locked = FALSE
      AND (
        forum_is_staff()
        OR forum_category_visible_core(t.category_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION forum_post_member_visible(p_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM forum_posts p
    WHERE p.id = p_post_id
      AND p.deleted_at IS NULL
      AND p.hidden_at IS NULL
      AND forum_thread_member_visible(p.thread_id)
  );
$$;

CREATE OR REPLACE FUNCTION forum_thread_subscriber_emails(p_thread_id uuid)
RETURNS TABLE (user_id uuid, email_encrypted bytea)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT s.user_id, u.email_encrypted
  FROM forum_subscriptions s
  JOIN users u ON u.id = s.user_id
  WHERE s.thread_id = p_thread_id
    AND s.user_id IS DISTINCT FROM NULLIF(current_setting('app.user_id', true), '')::uuid
    AND u.status = 'active'
    AND (
      forum_is_staff()
      OR forum_thread_member_visible(p_thread_id)
    );
$$;

CREATE OR REPLACE FUNCTION forum_bump_last_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE forum_threads
  SET last_posted_at = NEW.created_at
  WHERE id = NEW.thread_id
    AND deleted_at IS NULL;
  RETURN NEW;
END;
$$;

DO $owner_policies$
DECLARE
  owner_role text := current_user;
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS forum_categories_owner ON forum_categories');
  EXECUTE format(
    'CREATE POLICY forum_categories_owner ON forum_categories FOR ALL TO %I USING (true) WITH CHECK (true)',
    owner_role
  );
  EXECUTE format('DROP POLICY IF EXISTS forum_threads_owner ON forum_threads');
  EXECUTE format(
    'CREATE POLICY forum_threads_owner ON forum_threads FOR ALL TO %I USING (true) WITH CHECK (true)',
    owner_role
  );
  EXECUTE format('DROP POLICY IF EXISTS forum_posts_owner ON forum_posts');
  EXECUTE format(
    'CREATE POLICY forum_posts_owner ON forum_posts FOR ALL TO %I USING (true) WITH CHECK (true)',
    owner_role
  );
  EXECUTE format('DROP POLICY IF EXISTS forum_subscriptions_owner ON forum_subscriptions');
  EXECUTE format(
    'CREATE POLICY forum_subscriptions_owner ON forum_subscriptions FOR ALL TO %I USING (true) WITH CHECK (true)',
    owner_role
  );
END
$owner_policies$;

DROP POLICY forum_posts_insert ON "forum_posts";

CREATE POLICY forum_posts_insert ON "forum_posts"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.status', true) = 'active'
    AND author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND (
      forum_thread_writable(thread_id)
      OR (
        forum_is_staff()
        AND EXISTS (
          SELECT 1
          FROM forum_threads t
          WHERE t.id = thread_id
            AND t.deleted_at IS NULL
            AND t.hidden_at IS NULL
            AND t.locked = FALSE
        )
      )
    )
  );
