# Permission matrix contract (PRD §3) — this slice

Run **twice**: application (`pnpm test`) and database-only (`pnpm test:rls`). `requireRole` is not mocked in the application run.

Legend: **A** = allow in this slice, **D** = deny, **FC** = fail-closed (still not built).

Delta from `005-announcements`: **View events**, **RSVP to events**, and **Create / edit / delete events** move from FC → built. Moderator is **A** on create/edit/delete events (unlike announcements).

| Capability | Super Admin | Admin | Moderator | Pathways | LEAD | Pending | Invited |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Log in | A | A | A | A | A | A | D |
| View dashboard | A | A | A | A | A | holding only | D |
| View shared resources | A | A | A | A | A | D | D |
| View role-specific resources | A | A | A | A | A | D | D |
| Download resources | A | A | A | A | A | D | D |
| Upload / edit / delete resources | A | A | D | D | D | D | D |
| **View events** | **A** | **A** | **A** | **A** | **A** | D | D |
| **RSVP to events** | **A** | **A** | **A** | **A** | **A** | D | D |
| **Create / edit / delete events** | **A** | **A** | **A** | D | D | D | D |
| View directory | FC | FC | FC | FC | FC | D | D |
| Appear in directory | FC | FC | FC | FC | FC | D | D |
| View forum | FC | FC | FC | FC | FC | D | D |
| Post to forum | FC | FC | FC | FC | FC | D | D |
| Moderate forum | FC | FC | FC | D | D | D | D |
| View announcements | A | A | A | A | A | D | D |
| Create / manage announcements | A | A | D | D | D | D | D |
| Approve / deny registrations | A | A | D | D | D | D | D |
| Assign / change roles | FC | FC | D | D | D | D | D |
| View analytics dashboard | FC | FC | D | D | D | D | D |
| View audit log | A (full) | A (90d) | D | D | D | D | D |
| Change system configuration | FC | D | D | D | D | D | D |

Invited = token holder with no user row (cannot log in). View/RSVP for Pathways/LEAD is role-targeted (visibility intersection + not cancelled). Moderator view is all visibilities for uncancelled events (tokens include both programs). Create/edit/delete includes cancel. Admin/Super Admin without a program role see only `all_authenticated` on **member** queries; admin queries see every row.

## Visibility (layer 3) — `events`

Same intersection rules as `resources`, plus cancel. No activation window.

| Record | Pathways | LEAD | Moderator | Admin / Super Admin (program none, **member** query) | Admin / Super Admin / Moderator (**admin** query) | Pending |
| --- | --- | --- | --- | --- | --- | --- |
| uncancelled `{pathways}` | see | hide | see | hide | see | hide |
| uncancelled `{lead}` | hide | see | see | hide | see | hide |
| uncancelled `{all_authenticated}` | see | see | see | see | see | hide |
| uncancelled `{pathways, lead}` | see | see | see | hide | see | hide |
| cancelled (any visibility) | hide | hide | hide | hide | see | hide |

Join-link SELECT is stricter than event SELECT (Yes + window). See [rls-policies.md](./rls-policies.md).

RSVP INSERT/UPDATE is allowed only for a row that actor can **see** as uncancelled. Moderator can RSVP on member routes; can also create/edit/cancel.

## Extra assertions (required)

Application + RLS:

- Pathways, LEAD, Pending: deny `/admin/events`, create, edit, cancel. No management payloads.
- Admin/Super Admin/Moderator without `mfa_satisfied`: deny admin event routes.
- Client-supplied role never reveals a LEAD-only event to Pathways (or reverse).
- Pending: 0 event rows from member home / calendar / RSVP / ICS.
- After cancel, members omit it; staff still list it as cancelled.
- Every new route handler: unauthorized role rejected, not only authorized accepted.
- Analytics payloads for viewed/RSVP contain 0 PII and 0 event copy.
- ICS and mail omit join URL outside the reveal window.
