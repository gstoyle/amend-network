# Permission matrix contract (PRD §3) — this slice

Run **twice**: application (`pnpm test`) and database-only (`pnpm test:rls`). `requireRole` is not mocked in the application run.

Legend: **A** = allow in this slice, **D** = deny, **FC** = fail-closed (still not built).

Delta from `002-auth-rbac`: **Approve / deny registrations** moves from FC → **A** for Super Admin and Admin.

| Capability | Super Admin | Admin | Moderator | Pathways | LEAD | Pending | Invited |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Log in | A | A | A | A | A | A | D |
| View dashboard | A | A | A | A | A | holding only | D |
| View shared resources | FC | FC | FC | FC | FC | D | D |
| View role-specific resources | FC | FC | FC | FC | FC | D | D |
| Download resources | FC | FC | FC | FC | FC | D | D |
| Upload / edit / delete resources | FC | FC | D | D | D | D | D |
| View events | FC | FC | FC | FC | FC | D | D |
| RSVP to events | FC | FC | FC | FC | FC | D | D |
| Create / edit / delete events | FC | FC | FC | D | D | D | D |
| View directory | FC | FC | FC | FC | FC | D | D |
| Appear in directory | FC | FC | FC | FC | FC | D | D |
| View forum | FC | FC | FC | FC | FC | D | D |
| Post to forum | FC | FC | FC | FC | FC | D | D |
| Moderate forum | FC | FC | FC | D | D | D | D |
| View announcements | FC | FC | FC | FC | FC | D | D |
| Create / manage announcements | FC | FC | D | D | D | D | D |
| **Approve / deny registrations** | **A** | **A** | D | D | D | D | D |
| Assign / change roles | FC | FC | D | D | D | D | D |
| View analytics dashboard | FC | FC | D | D | D | D | D |
| View audit log | A (full) | A (90d) | D | D | D | D | D |
| Change system configuration | FC | D | D | D | D | D | D |

`role_assigned` as a **side effect of approve or invite-accept** is part of Approve / deny (and invite), not the general “Assign / change roles” row. DOC list CRUD is **not** “Change system configuration” (spec assumption: Admin + Super Admin). Invited = token holder with no user row (cannot log in).

## Extra assertions (required)

Application + RLS:

- Moderator, Pathways, LEAD, Pending: deny `/admin/users/pending`, `/admin/users/invite`, `/admin/users/affiliations`, approve, deny, send/revoke/re-issue invite, DOC mutations. No PII returned.
- Admin and Super Admin with `mfa_satisfied`: allow those paths.
- Admin without `mfa_satisfied`: deny (existing admin layout).
- Client-supplied role never grants approve/invite/DOC.
- Public `/register` cannot create `admin_role ≠ none` or `status = active`.
- Pending user cannot self-update `status` to `active` (RLS).
- Invite completion cannot set `admin_role ≠ none`.

Visibility fixture table: unchanged from `002-auth-rbac`.
