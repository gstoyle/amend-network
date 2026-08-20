# Quickstart: Community Forum

1. Apply migration `20260819140000_forum`.
2. Sign in as a Pathways member → `/app/forum` shows Pathways welcome + all-members.
3. Start a thread; reply; flag a post.
4. Sign in as staff with MFA → `/admin/forum/flags` → hide the post; confirm the member no longer sees it.
5. Confirm json email transport wrote a subscriber notice after a second author’s reply.
6. `pnpm test` and `pnpm test:rls` include view/post/moderate forum.
