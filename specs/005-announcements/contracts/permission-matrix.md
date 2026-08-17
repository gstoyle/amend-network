# Permission matrix contract (PRD §3) — this slice

Run **twice**: application (`pnpm test`) and database-only (`pnpm test:rls`). `requireRole` is not mocked in the application run.

Legend: **A** = allow in this slice, **D** = deny, **FC** = fail-closed (still not built).

Delta from `004-resource-library`: **View announcements** and **Create / manage announcements** move from FC → built.

| Capability | Super Admin | Admin | Moderator | Pathways | LEAD | Pending | Invited |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Log in | A | A | A | A | A | A | D |
| View dashboard | A | A | A | A | A | holding only | D |
| View shared resources | A | A | A | A | A | D | D |
| View role-specific resources | A | A | A | A | A | D | D |
| Download resources | A | A | A | A | A | D | D |
| Upload / edit / delete resources | A | A | D | D | D | D | D |
| View events | FC | FC | FC | FC | FC | D | D |
| RSVP to events | FC | FC | FC | FC | FC | D | D |
| Create / edit / delete events | FC | FC | FC | D | D | D | D |
| View directory | FC | FC | FC | FC | FC | D | D |
| Appear in directory | FC | FC | FC | FC | FC | D | D |
| View forum | FC | FC | FC | FC | FC | D | D |
| Post to forum | FC | FC | FC | FC | FC | D | D |
| Moderate forum | FC | FC | FC | D | D | D | D |
| **View announcements** | **A** | **A** | **A** | **A** | **A** | D | D |
| **Create / manage announcements** | **A** | **A** | D | D | D | D | D |
| Approve / deny registrations | A | A | D | D | D | D | D |
| Assign / change roles | FC | FC | D | D | D | D | D |
| View analytics dashboard | FC | FC | D | D | D | D | D |
| View audit log | A (full) | A (90d) | D | D | D | D | D |
| Change system configuration | FC | D | D | D | D | D | D |

Invited = token holder with no user row (cannot log in). View announcements for Pathways/LEAD is role-targeted (visibility intersection + window + not dismissed + cap). Moderator view is all visibilities for in-window live banners (tokens include both programs). Create/manage includes create, edit, and withdraw.

## Visibility (layer 3) — `announcements`

Same intersection rules as `resources`, plus window and withdraw. Cap of two is layer 2 only.

| Record | Pathways | LEAD | Moderator | Admin / Super Admin (program none, **member** query) | Admin / Super Admin (**admin** query) | Pending |
| --- | --- | --- | --- | --- | --- | --- |
| live in-window `{pathways}` | see | hide | see | hide | see | hide |
| live in-window `{lead}` | hide | see | see | hide | see | hide |
| live in-window `{all_authenticated}` | see | see | see | see | see | hide |
| live in-window `{pathways, lead}` | see | see | see | hide | see | hide |
| scheduled (any visibility) | hide | hide | hide | hide | see | hide |
| expired (any visibility) | hide | hide | hide | hide | see | hide |
| withdrawn (any visibility) | hide | hide | hide | hide | see | hide |
| live in-window but dismissed by this user | hide | hide | hide | hide | see (admin query) | hide |

Dismiss/CTA is allowed only for a row that actor can **see** as live in-window (and, for dismiss, `dismissible`). Moderator can see every live in-window visibility; cannot create/edit/withdraw.

## Extra assertions (required)

Application + RLS:

- Moderator, Pathways, LEAD, Pending: deny `/admin/announcements`, create, edit, withdraw. No management payloads.
- Admin/Super Admin without `mfa_satisfied`: deny admin announcement routes.
- Client-supplied role never reveals a LEAD-only banner to Pathways (or reverse).
- Pending: 0 announcement rows from member chrome / dismiss / CTA.
- Three in-window Pathways-visible banners: member chrome returns the **most recently activated two** (`activates_at`, not `created_at`).
- After dismiss, that banner is omitted for that user; another user still sees it if eligible.
- Every new route handler: unauthorized role rejected, not only authorized accepted.
- Analytics payloads for impression/CTA contain 0 PII and 0 announcement copy.
