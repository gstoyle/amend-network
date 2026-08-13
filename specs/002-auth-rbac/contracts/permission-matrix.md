# Permission matrix contract (PRD §3)

Run **twice**: application (`pnpm test`) and database-only (`pnpm test:rls`). `requireRole` is not mocked in the application run.

Legend: **A** = allow in this slice, **D** = deny, **FC** = fail-closed (capability not built; must deny).

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
| Approve / deny registrations | FC | FC | D | D | D | D | D |
| Assign / change roles | FC | FC | D | D | D | D | D |
| View analytics dashboard | FC | FC | D | D | D | D | D |
| View audit log | A (full) | A (90d) | D | D | D | D | D |
| Change system configuration | FC | D | D | D | D | D | D |

## Visibility fixture (layer 3)

| Record visibility | Pathways | LEAD | Moderator | Admin / Super Admin (program none) | Pending |
| --- | --- | --- | --- | --- | --- |
| `{pathways}` | see | hide | see | hide (no program token; not all_authenticated) | hide |
| `{lead}` | hide | see | see | hide | hide |
| `{all_authenticated}` | see | see | see | see | hide |
| `{pathways, lead}` | see | see | see | hide | hide |

Admin/Super Admin with `program_role = none` see `all_authenticated` only on the fixture unless a later content slice grants staff override. Moderator sees both program tokens (spec assumption: moderation).

## Extra assertions

- Client-supplied role never increases visibility.
- `/admin` without `mfa_satisfied` → deny even if `admin_role` is set.
- RLS run: same visibility table with GUCs set; application code not loaded.
