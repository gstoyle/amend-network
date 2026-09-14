-- Rename the Pathways launch network to the first International Immersion trip group.
-- The program_role token stays `pathways` so existing visibility rows and RLS keep working.

UPDATE networks
SET name = 'Norway & Northern Ireland | Fall 2026'
WHERE name = 'Pathways to Change';
