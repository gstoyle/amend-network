# Audit event contract (this slice)

Writer remains `lib/audit/write(tx, event)` in the **same transaction** as the change. `metadata` MUST NOT contain emails, names, title, description, location, or join URLs.

## Actions this slice MUST emit

| action | severity | actor | notes |
| --- | --- | --- | --- |
| `event_created` | info | staff | `entity_type=event`, `entity_id=id`; only after successful INSERT |
| `event_edited` | info | staff | field / visibility / time / capacity / join-URL edit |
| `event_cancelled` | info | staff | cancel only (`cancelled_at` set; row retained) |
| `event_rsvp` | info | member (or staff RSVP-as-self) | metadata `{ rsvpStatus }` or `{ fromStatus, toStatus }`; waitlist and promotion included |

Validation failure: **no** `event_created`. Failed RSVP: **no** `event_rsvp`.

## Check constraint

Event actions are already on `audit_log.action` from `002-auth-rbac`. No migration of the check list required.

## Still not emitted here

Lifecycle, resources, announcements, forum, directory, audit export. `event_viewed` and `event_rsvp` **analytics** `track()` calls are not audit rows (RSVP still has an audit row as above). Reminder send is mail only unless a later spec adds `event_reminder_sent`.
