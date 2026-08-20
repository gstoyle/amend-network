# HTTP contract: forum

All `/app/forum*` and `/admin/forum*` require a session. Handlers call `requireRole` before data.

| Method | Path | Who | Effect |
| --- | --- | --- | --- |
| GET | `/app/forum` | active member | categories the caller can see |
| GET | `/app/forum/[slug]` | active member | threads in that category |
| GET/POST | `/app/forum/[slug]/new` | active member | create thread + first post |
| GET | `/app/forum/t/[id]` | active member | posts; track `forum_thread_viewed` |
| POST | `/app/forum/t/[id]/reply` | active member | add post |
| POST | `/app/forum/t/[id]/subscribe` | active member | toggle subscription |
| POST | `/app/forum/posts/[id]/edit` | author within 15 min | update body |
| POST | `/app/forum/posts/[id]/flag` | active member | open flag |
| GET | `/community-guidelines` | public | static rules |
| GET | `/app/forum/unsubscribe` | token | HMAC unsubscribe |
| GET/POST | `/admin/forum` | admin, super_admin, MFA | categories |
| GET | `/admin/forum/flags` | staff, MFA | open flags |
| POST | `/admin/forum/posts/[id]/hide` etc. | staff, MFA | moderate |

Analytics payloads: `distinctId`, `programRole`, `adminRole`, `threadId` and/or `postId` only.
