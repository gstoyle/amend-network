# RLS Contract: Programme Cohorts

Every row below is asserted by `pnpm test:rls` with the application bypassed.

## Token derivation

| ID | Caller | `app_role_tokens()` contains |
|----|--------|------------------------------|
| RLS-COH-TOK-1 | Active member of cohort A (GLE) | `all_authenticated`, `pathways`, `cohort:A` |
| RLS-COH-TOK-2 | Same member, also in cohort B (LEAD) | adds `lead`, `cohort:B` |
| RLS-COH-TOK-3 | Moderator | `pathways`, `lead`, every `cohort:*` |
| RLS-COH-TOK-4 | Pending member of cohort A | empty |
| RLS-COH-TOK-5 | Member removed from cohort B in the same transaction | no `cohort:B` on the next statement |

## Content visibility (resources, events, announcements, forum categories/threads/posts)

| ID | Fixture visibility | Member A (GLE cohort A) | Member C (GLE cohort C) | LEAD member | Moderator | Admin |
|----|--------------------|-------------------------|-------------------------|-------------|-----------|-------|
| RLS-COH-VIS-1 | `{cohort:A}` | see | no | no | see | see |
| RLS-COH-VIS-2 | `{cohort:A,cohort:C}` | see | see | no | see | see |
| RLS-COH-VIS-3 | `{pathways}` | see | see | no | see | see |
| RLS-COH-VIS-4 | `{cohort:<archived A>}` | see | no | no | see | see |
| RLS-COH-VIS-5 | `{cohort:<unknown uuid>}` | no | no | no | no | see |

Forum write policies (`forum_member_listed()`, insert checks) apply unchanged on cohort rooms.

## Writes

| ID | Action | Allowed | Refused |
|----|--------|---------|---------|
| RLS-COH-W-1 | INSERT/UPDATE `networks` | admin, super_admin | moderator, members, pending |
| RLS-COH-W-2 | DELETE `networks` | nobody (`amend_app` has no grant) | all |
| RLS-COH-W-3 | INSERT `user_networks` | admin, super_admin, target `program_role <> 'none'` | moderator, members; staff-only target |
| RLS-COH-W-4 | DELETE `user_networks` non-primary | admin, super_admin | moderator, members |
| RLS-COH-W-5 | DELETE `user_networks` primary row | nobody (trigger raises) | all |
| RLS-COH-W-6 | Content INSERT with token `cohort:bad` | — | CHECK `visibility_tokens_valid` |

## Directory

| ID | Caller | `directory_listing_cohorts(ids)` returns |
|----|--------|------------------------------------------|
| RLS-COH-DIR-1 | GLE member | cohort pairs for listed GLE members only |
| RLS-COH-DIR-2 | GLE member, target unlisted | nothing for that target |
| RLS-COH-DIR-3 | Staff | pairs for every listed member |
| RLS-COH-DIR-4 | Dual-programme target viewed by GLE-only member | GLE cohorts only, LEAD cohort withheld |
