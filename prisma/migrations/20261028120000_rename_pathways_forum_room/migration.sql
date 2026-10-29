-- The `pathways` programme is shown to members as Global Learning Experiences. The forum seed
-- room still carried the old name. Each column changes only while it holds the original seed
-- value, so a room an Admin has already renamed or re-described is left alone.
UPDATE "forum_categories"
SET
  "name" = CASE
    WHEN "name" = 'Pathways — Welcome' THEN 'Global Learning Experiences — Welcome'
    ELSE "name"
  END,
  "slug" = CASE
    WHEN "slug" = 'pathways-welcome'
      AND NOT EXISTS (SELECT 1 FROM "forum_categories" WHERE "slug" = 'global-learning-welcome')
      THEN 'global-learning-welcome'
    ELSE "slug"
  END,
  "description" = CASE
    WHEN "description" = 'A room for Pathways members to introduce themselves and share what is working.'
      THEN 'A room for Global Learning Experiences members to introduce themselves and share what is working.'
    ELSE "description"
  END
WHERE "id" = '11111111-1111-4111-8111-111111111111';
