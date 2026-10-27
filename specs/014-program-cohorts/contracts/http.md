# Routes and Server Actions

All pages call `requireRole` from the signed session. Admin pages require `admin: ["admin","super_admin"]` and `mfa: true` (honours `ADMIN_MFA_REQUIRED`). Every action input is Zod-parsed. Refusals redirect to `/login` or return a generic message that never confirms existence.

## `/admin/cohorts`

- **GET**: cohorts grouped by programme: name, member count, active or archived.
- `createCohortAction(name, programRole)` → `cohort_created`. Errors: duplicate name ("That name is already in use."), invalid programme.
- `renameCohortAction(id, name)` → `cohort_renamed`.
- `archiveCohortAction(id)` / `unarchiveCohortAction(id)` → `cohort_archived` / `cohort_unarchived`.

## `/admin/cohorts/[id]`

- **GET**: cohort details and members (decrypted name, primary flag). Unknown id → 404.
- `addMemberAction(cohortId, email)`: looks up by email lookup hash. Unknown email, staff-only account, or already a member → one generic message: "No eligible member with that email." → `cohort_member_added`.
- `removeMemberAction(cohortId, userId)`: refuses the primary cohort with "This is the member's primary cohort and can't be removed here." → `cohort_member_removed`.

## Changed surfaces

- `/admin/resources/new|[id]`, `/admin/events/new|[id]`, `/admin/announcements/new|[id]`, `/admin/forum`: visibility fieldset with *Everyone signed in* (not on forum), programmes, and active cohorts grouped by programme. An item's existing archived cohorts show as checked and labelled "(archived)".
- `/admin/resources`, `/admin/events`, `/admin/announcements`: `?group=<token>&targeted=1`. `group` is `pathways`, `lead`, or `cohort:<uuid>` and is Zod-parsed against known tokens; anything else means All. Filtering is in the query (`visibility && <group's audience tokens>`, or `visibility @> {token}` when `targeted=1`), on top of the existing role check and RLS. The filter is a labelled select plus a checkbox, submitted as GET so the URL can be shared between staff.
- `/register`, `/admin/users/invite`, invite CSV: active cohorts only.
- `/app/directory`: `?cohort=<uuid>` filter. Values outside the viewer's programmes are ignored (treated as no filter).
- Admin nav: add **Cohorts** under Member administration.
