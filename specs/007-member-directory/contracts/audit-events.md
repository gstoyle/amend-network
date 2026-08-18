# Audit event contract (this slice)

Writer remains `lib/audit/write(tx, event)` in the **same transaction** as the change. `metadata` MUST NOT contain emails, names, titles, DOC affiliation labels/ids, or search query text.

## Actions this slice MUST emit

| action | severity | actor | notes |
| --- | --- | --- | --- |
| `directory_privacy_changed` | info | member (self) | After successful listing or field-toggle save. `entity_type=user`, `entity_id=self`. metadata: `{ listing?, showTitle?, showDocAffiliation?, showEmail? }` only for keys that changed, boolean new values. |
| `directory_profile_viewed` | info | viewer | After successful load of **another** member’s directory profile. `target_user_id=viewed`. metadata `{}`. Not written for self-view of `/app/directory/[own id]`. Not written when the profile is withheld. |

Validation failure on privacy save: **no** `directory_privacy_changed`. Withheld profile: **no** `directory_profile_viewed`.

## Check constraint

Directory actions are already on `audit_log.action` from `002-auth-rbac`. No migration of the check list required.

## Still not emitted here

Lifecycle, resources, events, announcements, forum, audit export. `directory_search` and `directory_profile_viewed` **analytics** `track()` calls are not audit rows (profile view still has an audit row as above). Refused rate-limited searches write neither.
