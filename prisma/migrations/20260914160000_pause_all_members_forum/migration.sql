-- Pause the all-members forum until Amend has moderation capacity.
-- Empty visibility does not intersect app_role_tokens(), so members cannot
-- list or open the room. Staff still SELECT via forum_is_staff().
--
-- Locking threads must run as staff: forum_author_thread_delete_guard treats
-- any other UPDATE of `locked` as a member edit and raises P0001.

ALTER TABLE forum_categories DROP CONSTRAINT IF EXISTS forum_categories_visibility_check;
ALTER TABLE forum_categories ADD CONSTRAINT forum_categories_visibility_check CHECK (
  visibility <@ ARRAY['all_authenticated', 'pathways', 'lead']::text[]
);

UPDATE forum_categories
SET
  visibility = ARRAY[]::text[],
  name = 'All members — General (paused)',
  description = 'Cross-programme discussion is paused until Amend has moderation capacity.'
WHERE slug = 'all-members-general';

SELECT set_config('app.admin_role', 'super_admin', true);

UPDATE forum_threads
SET locked = TRUE
WHERE deleted_at IS NULL
  AND locked IS DISTINCT FROM TRUE
  AND category_id IN (
    SELECT id FROM forum_categories WHERE slug = 'all-members-general'
  );
