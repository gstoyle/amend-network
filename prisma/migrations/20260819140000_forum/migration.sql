-- Community forum: tables, visibility cores, native RLS, grants, seed categories.

CREATE TABLE "forum_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "visibility" TEXT[] NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forum_categories_slug_key" UNIQUE ("slug"),
    CONSTRAINT "forum_categories_name_check" CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT "forum_categories_slug_check" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT "forum_categories_description_check" CHECK (char_length(description) BETWEEN 1 AND 500),
    CONSTRAINT "forum_categories_visibility_check" CHECK (
      visibility <@ ARRAY['all_authenticated', 'pathways', 'lead']::text[]
      AND cardinality(visibility) >= 1
    )
);

CREATE INDEX "forum_categories_visibility_idx" ON "forum_categories" USING GIN ("visibility");
CREATE INDEX "forum_categories_sort_order_idx" ON "forum_categories" ("sort_order");

CREATE TABLE "forum_threads" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT FALSE,
    "locked" BOOLEAN NOT NULL DEFAULT FALSE,
    "last_posted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hidden_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forum_threads_title_check" CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
    CONSTRAINT "forum_threads_author_label_check" CHECK (char_length(btrim(author_label)) BETWEEN 1 AND 80),
    CONSTRAINT "forum_threads_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "forum_categories"("id") ON DELETE RESTRICT
);

CREATE INDEX "forum_threads_category_last_posted_idx"
  ON "forum_threads" ("category_id", "last_posted_at" DESC);

CREATE TABLE "forum_posts" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_label" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),
    "hidden_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forum_posts_body_check" CHECK (char_length(btrim(body)) BETWEEN 1 AND 8000),
    CONSTRAINT "forum_posts_author_label_check" CHECK (char_length(btrim(author_label)) BETWEEN 1 AND 80),
    CONSTRAINT "forum_posts_thread_id_fkey"
      FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE RESTRICT
);

CREATE INDEX "forum_posts_thread_created_idx" ON "forum_posts" ("thread_id", "created_at");

CREATE TABLE "forum_flags" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resolver_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_flags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forum_flags_reason_check" CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
    CONSTRAINT "forum_flags_status_check" CHECK (status IN ('open', 'kept', 'hidden', 'deleted')),
    CONSTRAINT "forum_flags_post_id_fkey"
      FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE RESTRICT
);

CREATE INDEX "forum_flags_status_created_idx" ON "forum_flags" ("status", "created_at");

CREATE TABLE "forum_subscriptions" (
    "user_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_subscriptions_pkey" PRIMARY KEY ("user_id", "thread_id"),
    CONSTRAINT "forum_subscriptions_thread_id_fkey"
      FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE RESTRICT
);

CREATE TABLE "forum_post_throttle" (
    "user_id" UUID NOT NULL,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "post_count" INTEGER NOT NULL,
    "thread_window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "thread_count" INTEGER NOT NULL,
    "hour_window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "hour_count" INTEGER NOT NULL,
    CONSTRAINT "forum_post_throttle_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "forum_post_throttle_counts_check" CHECK (
      post_count >= 0 AND thread_count >= 0 AND hour_count >= 0
    )
);

CREATE FUNCTION forum_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator');
$$;

CREATE FUNCTION forum_is_content_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.admin_role', true) IN ('admin', 'super_admin');
$$;

CREATE FUNCTION forum_category_visible_core(p_category_id uuid)
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

CREATE FUNCTION forum_thread_member_visible(p_thread_id uuid)
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

CREATE FUNCTION forum_thread_writable(p_thread_id uuid)
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
      AND forum_category_visible_core(t.category_id)
  );
$$;

CREATE FUNCTION forum_post_member_visible(p_post_id uuid)
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

CREATE FUNCTION forum_thread_subscriber_emails(p_thread_id uuid)
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

CREATE FUNCTION forum_member_post_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF forum_is_staff() THEN
    RETURN NEW;
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.thread_id IS DISTINCT FROM OLD.thread_id
     OR NEW.author_label IS DISTINCT FROM OLD.author_label
     OR NEW.hidden_at IS DISTINCT FROM OLD.hidden_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'forum_posts: members may only edit body';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER forum_member_post_update_guard
  BEFORE UPDATE ON "forum_posts"
  FOR EACH ROW
  EXECUTE FUNCTION forum_member_post_update_guard();

CREATE FUNCTION forum_bump_last_posted()
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

CREATE TRIGGER forum_bump_last_posted
  AFTER INSERT ON "forum_posts"
  FOR EACH ROW
  EXECUTE FUNCTION forum_bump_last_posted();

REVOKE ALL ON FUNCTION forum_is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION forum_is_content_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION forum_category_visible_core(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION forum_thread_member_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION forum_thread_writable(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION forum_post_member_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION forum_thread_subscriber_emails(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION forum_member_post_update_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION forum_bump_last_posted() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION forum_is_staff() TO amend_app;
GRANT EXECUTE ON FUNCTION forum_is_content_admin() TO amend_app;
GRANT EXECUTE ON FUNCTION forum_category_visible_core(uuid) TO amend_app;
GRANT EXECUTE ON FUNCTION forum_thread_member_visible(uuid) TO amend_app;
GRANT EXECUTE ON FUNCTION forum_thread_writable(uuid) TO amend_app;
GRANT EXECUTE ON FUNCTION forum_post_member_visible(uuid) TO amend_app;
GRANT EXECUTE ON FUNCTION forum_thread_subscriber_emails(uuid) TO amend_app;
GRANT EXECUTE ON FUNCTION forum_member_post_update_guard() TO amend_app;
GRANT EXECUTE ON FUNCTION forum_bump_last_posted() TO amend_app;

INSERT INTO "forum_categories" ("id", "name", "slug", "description", "visibility", "sort_order")
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'Pathways — Welcome',
    'pathways-welcome',
    'A room for Pathways members to introduce themselves and share what is working.',
    ARRAY['pathways']::text[],
    10
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'LEAD — Welcome',
    'lead-welcome',
    'A room for LEAD members to introduce themselves and share what is working.',
    ARRAY['lead']::text[],
    20
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'All members — General',
    'all-members-general',
    'Cross-programme discussion visible to every active member.',
    ARRAY['all_authenticated']::text[],
    30
  );

ALTER TABLE "forum_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forum_categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "forum_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forum_threads" FORCE ROW LEVEL SECURITY;
ALTER TABLE "forum_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forum_posts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "forum_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forum_flags" FORCE ROW LEVEL SECURITY;
ALTER TABLE "forum_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forum_subscriptions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "forum_post_throttle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forum_post_throttle" FORCE ROW LEVEL SECURITY;

CREATE POLICY forum_categories_select ON "forum_categories"
  FOR SELECT TO amend_app
  USING (forum_category_visible_core(id) OR forum_is_staff());

CREATE POLICY forum_categories_insert ON "forum_categories"
  FOR INSERT TO amend_app
  WITH CHECK (forum_is_content_admin());

CREATE POLICY forum_categories_update ON "forum_categories"
  FOR UPDATE TO amend_app
  USING (forum_is_content_admin())
  WITH CHECK (forum_is_content_admin());

CREATE POLICY forum_threads_select ON "forum_threads"
  FOR SELECT TO amend_app
  USING (
    forum_is_staff()
    OR (
      deleted_at IS NULL
      AND hidden_at IS NULL
      AND forum_category_visible_core(category_id)
    )
  );

CREATE POLICY forum_threads_insert ON "forum_threads"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.status', true) = 'active'
    AND author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND forum_category_visible_core(category_id)
  );

CREATE POLICY forum_threads_update ON "forum_threads"
  FOR UPDATE TO amend_app
  USING (forum_is_staff())
  WITH CHECK (forum_is_staff());

CREATE POLICY forum_posts_select ON "forum_posts"
  FOR SELECT TO amend_app
  USING (
    forum_is_staff()
    OR (
      deleted_at IS NULL
      AND hidden_at IS NULL
      AND forum_thread_member_visible(thread_id)
    )
  );

CREATE POLICY forum_posts_insert ON "forum_posts"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.status', true) = 'active'
    AND author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND forum_thread_writable(thread_id)
  );

CREATE POLICY forum_posts_update_author ON "forum_posts"
  FOR UPDATE TO amend_app
  USING (
    author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND hidden_at IS NULL
    AND deleted_at IS NULL
  )
  WITH CHECK (
    author_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND hidden_at IS NULL
    AND deleted_at IS NULL
  );

CREATE POLICY forum_posts_update_staff ON "forum_posts"
  FOR UPDATE TO amend_app
  USING (forum_is_staff())
  WITH CHECK (forum_is_staff());

CREATE POLICY forum_flags_select ON "forum_flags"
  FOR SELECT TO amend_app
  USING (forum_is_staff());

CREATE POLICY forum_flags_insert ON "forum_flags"
  FOR INSERT TO amend_app
  WITH CHECK (
    current_setting('app.status', true) = 'active'
    AND reporter_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND forum_post_member_visible(post_id)
  );

CREATE POLICY forum_flags_update ON "forum_flags"
  FOR UPDATE TO amend_app
  USING (forum_is_staff())
  WITH CHECK (forum_is_staff());

CREATE POLICY forum_subscriptions_select ON "forum_subscriptions"
  FOR SELECT TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY forum_subscriptions_insert ON "forum_subscriptions"
  FOR INSERT TO amend_app
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND (
      forum_is_staff()
      OR forum_thread_member_visible(thread_id)
    )
  );

CREATE POLICY forum_subscriptions_delete ON "forum_subscriptions"
  FOR DELETE TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY forum_post_throttle_all ON "forum_post_throttle"
  FOR ALL TO amend_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE "forum_categories" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "forum_categories" FROM amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "forum_threads" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "forum_threads" FROM amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "forum_posts" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "forum_posts" FROM amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "forum_flags" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "forum_flags" FROM amend_app;
GRANT SELECT, INSERT, DELETE ON TABLE "forum_subscriptions" TO amend_app;
REVOKE UPDATE, TRUNCATE ON TABLE "forum_subscriptions" FROM amend_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "forum_post_throttle" TO amend_app;
REVOKE DELETE, TRUNCATE ON TABLE "forum_post_throttle" FROM amend_app;
