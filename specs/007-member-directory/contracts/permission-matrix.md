# Permission matrix contract (PRD §3) — this slice

Run **twice**: application (`pnpm test`) and database-only (`pnpm test:rls`). `requireRole` is not mocked in the application run.

Legend: **A** = allow in this slice, **D** = deny, **FC** = fail-closed (still not built).

Delta from `006-event-calendar`: **View directory** and **Appear in directory** move from FC → built.

| Capability | Super Admin | Admin | Moderator | Pathways | LEAD | Pending | Invited |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Log in | A | A | A | A | A | A | D |
| View dashboard | A | A | A | A | A | holding only | D |
| View shared resources | A | A | A | A | A | D | D |
| View role-specific resources | A | A | A | A | A | D | D |
| Download resources | A | A | A | A | A | D | D |
| Upload / edit / delete resources | A | A | D | D | D | D | D |
| View events | A | A | A | A | A | D | D |
| RSVP to events | A | A | A | A | A | D | D |
| Create / edit / delete events | A | A | A | D | D | D | D |
| **View directory** | **A** | **A** | **A** | **A** | **A** | D | D |
| **Appear in directory** | D | D | D | **A** | **A** | D | D |
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

Invited = token holder with no user row (cannot log in).

**View directory**: staff see opted-in members of **both** programs; Pathways see Pathways only; LEAD see LEAD only. Hidden fields omitted for everyone (uniform hide).

**Appear in directory**: matrix Super Admin / Admin / Moderator personas have no program role — they cannot create a listing. Pathways / LEAD **may** opt in (default off). Appear is not automatic.

## Extra assertions (required)

Application + RLS:

- Pending, invited, signed-out: 0 listing rows; privacy POST denied.
- Pathways: 0 LEAD listings; LEAD: 0 Pathways listings.
- Staff: both programs listed; hidden DOC/title/email still omitted.
- Client-supplied role never reveals a LEAD listing to Pathways.
- Search matching a hidden DOC affiliation or hidden title returns 0 hits for that member (not a blanked row).
- 31st search in the current minute: 0 result rows.
- Pathways `SELECT` other `users` rows: 0 (policy not widened).
- Every new route handler: unauthorized role rejected, not only authorized accepted.
