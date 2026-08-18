# Data Model: Member Directory

**Feature**: `007-member-directory` | **Cites**: PRD Appendix A.1 / A.4, spec Key Entities, [research.md](./research.md)

PII ciphertext is `bytea` (existing AES-256-GCM envelope). **Do not store plaintext names, titles, emails, or DOC ids on directory tables.**

## User (delta)

Existing columns unchanged except:

| Field | Type | Notes |
| --- | --- | --- |
| directory_visible | boolean | Default **false** (Q12 opt-in). Own-row read/write. |
| directory_show_title | boolean | Default **false**. Uniform hide. |
| directory_show_doc_affiliation | boolean | Default **false**. |
| directory_show_email | boolean | Default **false**. |
| directory_privacy_set_at | timestamptz nullable | Null → first-run prompt. Set when they save listing on **or** off. |

Booleans are the PRD `field_visibility` jsonb in concrete form (YAGNI jsonb). Own-row `UPDATE` WITH CHECK still must not change `status` / `program_role` / `admin_role`. These new columns **may** change on own-row UPDATE.

**Appear rule**: listing projection exists only if `directory_visible` and `status = active` and `program_role ∈ {pathways, lead}`. Staff with `program_role = none` never get a listing row.

## DirectoryListing

| Field | Type | Notes |
| --- | --- | --- |
| user_id | uuid PK | Same as `users.id`; **no FK** (consistent with other slices) |
| program_role | text | `pathways` \| `lead` at opt-in; used by RLS |
| network_id | uuid | For network search/display; join label in process |
| first_name_encrypted | bytea | Copy from `users` at privacy save |
| last_name_encrypted | bytea | Copy from `users` at privacy save |
| created_at / updated_at | timestamptz | |

**State**:

```text
(no row) --opt in--> listed
listed --opt out--> (no row)  + delete shown-field children
listed --privacy save--> refresh name copies + sync children
users.status leaves active --> DELETE listing + shown-field children; directory_visible = false
(layer 3 still requires status = active if a row were left behind)

```

## DirectoryShownTitle / DirectoryShownDoc / DirectoryShownEmail

Each: `user_id` PK, ciphertext column (`title_encrypted` / `doc_affiliation_id_encrypted` / `email_encrypted`), `updated_at`.

Row exists **only** when listing is on and that field is shown. Hide, opt-out, or `users.status` leaving `active` **deletes** the row (research §11). Do not leave unread ciphertext copies.

## DirectorySearchThrottle

| Field | Type | Notes |
| --- | --- | --- |
| user_id | uuid PK | Viewer |
| window_started_at | timestamptz | Start of current 60s window |
| search_count | int | 0–30; 31st attempt does not increment past refuse |

Own-row SELECT/INSERT/UPDATE. No DELETE grant needed (reset is UPDATE).

## Unchanged

`users` SELECT policy, `doc_affiliations` (vocabulary), `networks`, audit writer, encryption helpers. Directory does not FK-delete users.

## AuditLog (emit only)

| action | entity | notes |
| --- | --- | --- |
| directory_privacy_changed | user (self) | metadata: toggle keys only |
| directory_profile_viewed | viewed user id as `target_user_id` | other-member successful view only |

## Analytics (not tables)

`directory_search` — distinctId + roles. `directory_profile_viewed` — plus opaque `viewedUserId`. No `DirectoryProfileView` table this slice (PRD appendix sampling table unused; audit row is the record).
