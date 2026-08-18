# Permission matrix contract (PRD §3) — this slice

Run **twice**: application (`pnpm test`) and database-only (`pnpm test:rls`). `requireRole` is not mocked in the application run.

Legend: **A** = allow in this slice, **D** = deny, **FC** = fail-closed (still not built).

Delta from `007-member-directory`: **View analytics dashboard** moves from FC → built. **View audit log** stays built; export is Super Admin only (extra assertion).

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
| View directory | A | A | A | A | A | D | D |
| Appear in directory | D | D | D | A | A | D | D |
| View forum | FC | FC | FC | FC | FC | D | D |
| Post to forum | FC | FC | FC | FC | FC | D | D |
| Moderate forum | FC | FC | FC | D | D | D | D |
| View announcements | A | A | A | A | A | D | D |
| Create / manage announcements | A | A | D | D | D | D | D |
| Approve / deny registrations | A | A | D | D | D | D | D |
| Assign / change roles | FC | FC | D | D | D | D | D |
| **View analytics dashboard** | **A** | **A** | D | D | D | D | D |
| View audit log | A (full) | A (90d) | D | D | D | D | D |
| Change system configuration | FC | D | D | D | D | D | D |

Invited = token holder with no user row (cannot log in).

**View analytics dashboard**: MFA-satisfied Super Admin and Admin only. Identical aggregates (snapshot function). Moderator on `/admin` must not receive KPI numbers.

**View audit log**: unchanged windows. CSV export is **not** a matrix row; extra assert: Super Admin allow, Admin deny, no export audit row on deny.

## Extra assertions (required)

Application + RLS:

- Moderator, Pathways, LEAD, pending, signed-out: 0 analytics counts; 0 audit rows; export denied.
- Admin analytics snapshot numbers equal Super Admin on the same fixture.
- Admin raw `audit_log` SELECT: 0 rows older than 90 days.
- Client-supplied Super Admin role never grants analytics or export.
- `/admin/analytics` and export without `mfa_satisfied` → deny.
- Every new route handler: unauthorized role rejected, not only authorized accepted.
- Opening analytics writes 0 new audit action names and 0 product-analytics events.
- Successful viewer load: exactly one `audit_log_viewed`; successful export: exactly one `audit_log_exported`; 0 updates/deletes of existing trail rows.
- Snapshot `topResources` / `topEvents`: 0 rows with count < 3; each array length ≤ 10.
