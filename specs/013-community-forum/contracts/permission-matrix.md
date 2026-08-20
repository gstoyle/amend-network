# Permission matrix delta

PRD §3 capabilities now built:

| Capability | super_admin | admin | moderator | pathways | lead | pending | invited |
| --- | --- | --- | --- | --- | --- | --- | --- |
| view_forum | allow | allow | allow | allow | allow | deny | deny |
| post_forum | allow | allow | allow | allow | allow | deny | deny |
| moderate_forum | allow | allow | allow | deny | deny | deny | deny |

App proofs: `listForumCategories`, `createThread` (auth gate), `hidePost`.

RLS proofs: SELECT categories/threads/posts as each role; INSERT post as member; UPDATE hide as moderator; Pathways cannot SELECT LEAD-only rows.
