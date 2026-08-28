-- Staff can post in every category they can moderate, while active-status,
-- authorship, and thread-lock checks continue to apply.
DROP POLICY forum_threads_insert ON "forum_threads";

CREATE POLICY forum_threads_insert ON "forum_threads"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.status', true) = 'active'
    AND author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND (
      forum_is_staff()
      OR forum_category_visible_core(category_id)
    )
  );

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
