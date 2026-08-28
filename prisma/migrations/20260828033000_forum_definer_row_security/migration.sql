-- FORCE RLS applies to table owners. Render's migration role is not a
-- superuser, so SECURITY DEFINER helpers that read forum tables must turn
-- row security off or first-post inserts fail after the thread row exists.

CREATE OR REPLACE FUNCTION forum_category_visible_core(p_category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
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
SET row_security = off
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
SET row_security = off
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
SET row_security = off
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
SET row_security = off
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
SET row_security = off
AS $$
BEGIN
  UPDATE forum_threads
  SET last_posted_at = NEW.created_at
  WHERE id = NEW.thread_id
    AND deleted_at IS NULL;
  RETURN NEW;
END;
$$;

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
