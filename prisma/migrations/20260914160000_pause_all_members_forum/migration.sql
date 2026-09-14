-- Pause the all-members forum until Amend has moderation capacity.
-- Empty visibility does not intersect app_role_tokens(), so members cannot
-- list or open the room. Staff still SELECT via forum_is_staff().

ALTER TABLE forum_categories DROP CONSTRAINT forum_categories_visibility_check;
ALTER TABLE forum_categories ADD CONSTRAINT forum_categories_visibility_check CHECK (
  visibility <@ ARRAY['all_authenticated', 'pathways', 'lead']::text[]
);

UPDATE forum_categories
SET
  visibility = ARRAY[]::text[],
  name = 'All members — General (paused)',
  description = 'Cross-programme discussion is paused until Amend has moderation capacity.'
WHERE slug = 'all-members-general';

UPDATE forum_threads
SET locked = TRUE
WHERE deleted_at IS NULL
  AND category_id IN (
    SELECT id FROM forum_categories WHERE slug = 'all-members-general'
  );
