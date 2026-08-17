# Permission matrix contract (PRD §3) — this slice

Run **twice**: application (`pnpm test`) and database-only (`pnpm test:rls`). `requireRole` is not mocked in the application run.

Legend: **A** = allow in this slice, **D** = deny, **FC** = fail-closed (still not built).

Delta from `003-registration-invitation-approval`: **View shared resources**, **View role-specific resources**, **Download resources**, and **Upload / edit / delete resources** move from FC → built.

| Capability | Super Admin | Admin | Moderator | Pathways | LEAD | Pending | Invited |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Log in | A | A | A | A | A | A | D |
| View dashboard | A | A | A | A | A | holding only | D |
| **View shared resources** | **A** | **A** | **A** | **A** | **A** | D | D |
| **View role-specific resources** | **A** | **A** | **A** | **A** | **A** | D | D |
| **Download resources** | **A** | **A** | **A** | **A** | **A** | D | D |
| **Upload / edit / delete resources** | **A** | **A** | D | D | D | D | D |
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
| Approve / deny registrations | A | A | D | D | D | D | D |
| Assign / change roles | FC | FC | D | D | D | D | D |
| View analytics dashboard | FC | FC | D | D | D | D | D |
| View audit log | A (full) | A (90d) | D | D | D | D | D |
| Change system configuration | FC | D | D | D | D | D | D |

Invited = token holder with no user row (cannot log in). Upload/edit/delete includes ingest slots, publish, replace, and soft-delete.

## Visibility (layer 3) — `resources`

Same intersection rules as the 002 fixture, plus soft-delete and scan-commit:

| Record | Pathways | LEAD | Moderator | Admin / Super Admin (program none, **member** query) | Admin / Super Admin (**admin** query) | Pending |
| --- | --- | --- | --- | --- | --- | --- |
| live `{pathways}` | see | hide | see | hide | see | hide |
| live `{lead}` | hide | see | see | hide | see | hide |
| live `{all_authenticated}` | see | see | see | see | see | hide |
| live `{pathways, lead}` | see | see | see | hide | see | hide |
| withdrawn (any visibility) | hide | hide | hide | hide | see | hide |

Download is allowed only for a row that actor can **see** as live. Moderator can download every live visibility; cannot publish/edit/delete.

## Extra assertions (required)

Application + RLS:

- Moderator, Pathways, LEAD, Pending: deny `/admin/resources`, ingest, publish, replace, soft-delete. No management payloads.
- Admin/Super Admin without `mfa_satisfied`: deny admin resource routes.
- Client-supplied role never reveals a LEAD-only row to Pathways (or reverse).
- Pending: 0 resource rows from list/detail/download.
- Scan-failed publish: 0 `resources` rows; ingest objects deleted; no signed GET can be issued for those keys.
- Failed replace: live keys unchanged; new ingest deleted.
- Every new route handler: unauthorized role rejected, not only authorized accepted.
