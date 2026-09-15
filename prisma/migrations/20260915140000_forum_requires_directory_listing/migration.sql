-- Members must be directory-listed to post, flag, or subscribe.
-- Staff still participate via forum_is_staff() without appearing in the directory.
-- Invoker rights (not SECURITY DEFINER): users RLS already allows own-row SELECT.

CREATE OR REPLACE FUNCTION forum_member_listed()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = NULLIF(current_setting('app.user_id', true), '')::uuid
      AND u.directory_visible IS TRUE
      AND u.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION forum_member_listed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION forum_member_listed() TO amend_app;

DROP POLICY IF EXISTS forum_threads_insert ON forum_threads;

CREATE POLICY forum_threads_insert ON forum_threads
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.status', true) = 'active'
    AND author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND (
      forum_is_staff()
      OR (
        forum_member_listed()
        AND forum_category_visible_core(category_id)
      )
    )
  );

DROP POLICY IF EXISTS forum_posts_insert ON forum_posts;

CREATE POLICY forum_posts_insert ON forum_posts
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.status', true) = 'active'
    AND author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND (
      forum_is_staff()
      OR forum_member_listed()
    )
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

DROP POLICY IF EXISTS forum_flags_insert ON forum_flags;

CREATE POLICY forum_flags_insert ON forum_flags
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.status', true) = 'active'
    AND reporter_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND (
      forum_is_staff()
      OR (
        forum_member_listed()
        AND forum_post_member_visible(post_id)
      )
    )
  );

DROP POLICY IF EXISTS forum_subscriptions_insert ON forum_subscriptions;

CREATE POLICY forum_subscriptions_insert ON forum_subscriptions
  FOR INSERT TO amend_app
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND (
      forum_is_staff()
      OR (
        forum_member_listed()
        AND forum_thread_member_visible(thread_id)
      )
    )
  );
