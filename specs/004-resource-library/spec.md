# Feature Specification: Gated Resource Library

**Feature Branch**: `004-resource-library`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Start slice 004-resource-library (PRD §5.5). Cover: resource upload (admin), metadata (title, preview text, thumbnail, source label, tags, visibility), signed-URL downloads, search/filter/sort, soft-delete, malware scan via ClamAV, download audit logging. This is the first content table using the visibility text[] pattern from Constitution I (all_authenticated | pathways | lead). Reuse that pattern and the existing RLS/requireRole approach from 002-auth-rbac; do not invent a new authorization mechanism."

**Cites**: PRD v1.1 §2 (resource-engagement KPI), §3 (roles and permission matrix: view shared / view role-specific / download / upload-edit-delete resources), §4 (authorization model, visibility set), §5.5 (gated resource library), §6 System 1 (content–resources audit events), §8 (malware scan at ingest, CSRF, private object storage), Appendix A.2 (Resource), Appendix B.2–B.4 (`/app/resources`, `/admin/resources`); Constitution v1.0.0 Principles I, II, III, IV, V; `002-auth-rbac` visibility contract and three-layer authorization.

## Scope

This slice delivers **the member resource library and the admin publishing workflow**. Approved members browse and download only the files their roles allow. Super Admins and Admins upload those files, attach metadata and a visibility set, and can later edit, replace, or withdraw them. Every download is evidence in the audit log. No file is offered for download until it has passed malware scanning. Storage locations are never published; access is issued only after a server-side role check.

This is the **first product content table** that uses Constitution Principle I’s visibility set (`all_authenticated` | `pathways` | `lead`). It MUST reuse the visibility contract and the three-layer authorization already proven in `002-auth-rbac` (`requireRole` from the signed session, query filters, and native database row-level security). It MUST NOT introduce a second authorization model, a client-supplied role, or a vendor-specific policy layer.

A developer can exercise the library locally against a local database, environment-configured private storage, and a scan path that can return both clean and infected outcomes. Production hosting and the on-host malware daemon are not provisioned in this slice.

**In scope**

- Admin/Super Admin resource publishing: upload a file, required metadata (title, preview text, thumbnail, source label, tags, visibility), and create a single resource record
- Member library list (`/app/resources`) and detail (`/app/resources/[id]`) filtered by the signed session’s roles intersecting the resource’s visibility set
- Keyword search (title + preview text), tag filter, source filter, and sort (newest, most downloaded, alphabetical)
- Downloads issued only after a server-side role check, as short-lived access; direct storage URLs never exposed (including thumbnails)
- Malware scan of every uploaded file (and replacement file, and thumbnail) **in the same request** as publish or replace; the request does not complete until the scan result is known; only then may the resource be marked downloadable
- Edit metadata in place; replace the file while keeping the same resource identity; show last-updated on the detail page
- Soft-delete: the resource disappears from member view; the file is retained for the audit period
- Inline playback for video resources (members are not forced to download first); playback is still role-checked
- Audit events `resource_created`, `resource_edited`, `resource_deleted`, `resource_downloaded`
- Permission-matrix proofs for the four resource capabilities in PRD §3, run both through the application and with the application bypassed

**Out of scope**

- Sign-in, sessions, MFA, `requireRole`, the audit writer, and the visibility contract itself (already `002-auth-rbac`; this slice **consumes** them)
- Registration, invitation, and approval (`003-registration-invitation-approval`)
- Member-home dashboard cards (“recent resources”), events, announcements, directory, forum, and WordPress feed
- Semantic search across file contents (explicitly a later-phase idea in the PRD)
- Migrating an existing off-platform file library into this product
- Hard-delete / data-subject purge of stored files; restore-from-soft-delete as a dedicated workflow
- Quarantine or flagged-and-unreferenced storage for scan-failed files (rejected ingest objects are deleted; they are not retained for forensics)
- Admin analytics dashboards and download leaderboards (this slice writes the events those views will use later)
- Member-authored uploads; a public or unauthenticated library
- A new authorization mechanism, a second visibility vocabulary, or client-supplied roles
- DreamHost (or any production host) provisioning, including installing the production malware daemon — that remains infrastructure work
- Asynchronous scan workers, a durable “pending scan” resource state, and admin notification that a later scan finished (publish/replace wait for the scan result in the same request)

## Clarifications

### Session 2026-08-17

- Q: Should the admin wait on this publish (or replace) request until malware scanning of the uploaded files has finished, so success means the resource is already downloadable (or the whole attempt failed), rather than leaving a pending resource to scan later? → A: Synchronous — the request does not complete until the scan result is known. Success = downloadable; failure = not published (or replace rejected).
- Q: If the thumbnail fails the malware scan (or cannot be scanned) but the main file is clean, should the whole publish or replace fail, or may the main file go live without a thumbnail? → A: Fail the whole publish/replace. Neither the main file nor the thumbnail becomes available to members.
- Q: After a file or thumbnail fails the malware scan, what must happen to those bytes so that no later code path can serve them? → A: Delete rejected objects from storage. No resource record (or no new keys on replace). No product path can issue access. Previously live files on a failed replace stay as they were.

## User Scenarios & Testing *(mandatory)*

Primary actors: **Pathways member**, **LEAD member**, **Admin**, **Super Admin**. **Moderator** is a secondary actor (may view and download every resource for moderation, and MUST be refused publish/edit/delete). **Pending members**, **invited token holders**, and **signed-out visitors** must be refused without leaking whether a resource exists.

### User Story 1 - Admin publishes a resource with metadata and visibility (Priority: P1)

An Admin or Super Admin opens the admin resource workspace, uploads a file, and fills in title, preview text (up to 500 characters), a thumbnail image, a source label, optional tags (up to 10), and a visibility set of one or more of: everyone signed in, Pathways only, LEAD only. On success they have one resource with one file. Members who are allowed to see it can find it in the library; members who are not cannot. The same file is stored once even if more than one audience is selected.

**Why this priority**: Nothing else in the library exists until an authorized admin can publish a complete, visibility-tagged resource (PRD §5.5).

**Independent Test**: As Admin (MFA-satisfied), create one shared resource and one Pathways-only resource. Confirm both appear in the admin list. Confirm a Pathways member sees both, a LEAD member sees only the shared one, and a Moderator cannot open the publish form.

**Acceptance Scenarios**:

1. **Given** an MFA-satisfied Admin or Super Admin, **When** they submit a complete resource (file + required metadata + at least one visibility value) and the scan succeeds, **Then** the request completes with one downloadable resource (that metadata and file) and a `resource_created` audit row is written. The admin is not left waiting on a later scan.
2. **Given** a required field missing, a preview over 500 characters, more than 10 tags, a disallowed file type, or a file over 250 MB, **When** they submit, **Then** no resource is created and the reason is shown to that admin.
3. **Given** a resource visible to both Pathways and LEAD, **When** members of either program open the library, **Then** they see that single resource (not two copies).
4. **Given** a Moderator, Pathways member, LEAD member, or pending user, **When** they request the admin publish or edit screens, **Then** they are denied and no resource management data is returned.
5. **Given** an upload that fails before storage confirms the file, **When** the attempt finishes, **Then** no resource record exists (no partial/orphan listing).

---

### User Story 2 - Members browse only what their roles allow (Priority: P1)

A signed-in approved member opens `/app/resources` and sees cards for resources whose visibility set intersects their roles. Each card shows title, preview, thumbnail, source label, and tags. Opening a resource shows the same metadata plus a last-updated date. A Pathways member never sees a LEAD-only item (and the reverse). Pending members and signed-out visitors never see the library. If the application’s role check is skipped, the database still withholds rows the user’s roles do not intersect, including soft-deleted rows from members.

**Why this priority**: Unauthorized cross-role access is a launch-blocking incident (Constitution Principle I). This is the first real content table that must prove the visibility pattern in product, not only with a stand-in record.

**Independent Test**: Seed shared, Pathways-only, and LEAD-only resources. As each role, list and open by id (including guessed ids). Repeat the same reads directly against the database under that user’s identity. Confirm allows and denials match PRD §3.

**Acceptance Scenarios**:

1. **Given** no session, **When** a visitor requests `/app/resources` or a resource detail URL, **Then** they are sent to sign-in and no resource data is returned.
2. **Given** a Pathways member, **When** they list or open resources, **Then** they see `all_authenticated` and `pathways` items and do not see `lead`-only items (absent or not-found — not an error that names the other cohort).
3. **Given** a LEAD member, **When** they list or open resources, **Then** the withholding applies in reverse.
4. **Given** a Moderator, **When** they use the member library, **Then** they can see shared, Pathways, and LEAD resources (moderation), but they still cannot publish, edit, or delete.
5. **Given** a pending member with a valid session, **When** they request the library or a resource id, **Then** they remain on the holding experience and receive 0 resource records.
6. **Given** the application role check is bypassed, **When** the same user reads through the database under their identity, **Then** row-level policies still hide rows their roles do not intersect and still hide soft-deleted rows from members.
7. **Given** a client-supplied role claim that would grant extra access, **When** a library path runs, **Then** the signed session wins and the extra access fails.

---

### User Story 3 - Role-checked download with an audit row (Priority: P1)

An approved member who can see a downloadable resource chooses download. The server confirms their signed session is allowed to have that file, then issues short-lived access. The member receives the file. The page never contains a durable storage location. Every successful download writes `resource_downloaded` with actor, resource, time, and IP. A member who cannot see the resource cannot download it, including by guessing the id or pasting a storage location.

**Why this priority**: Downloads are the engagement KPI and a security boundary (PRD §2, §5.5, Constitution Principle III). Unsigned or un-checked file URLs would bypass visibility.

**Independent Test**: As a Pathways member, download a shared resource and a Pathways-only resource; confirm an audit row each time and that the response is not a durable storage URL. Attempt a LEAD-only id, a soft-deleted id, and a pending session; confirm denial and no file.

**Acceptance Scenarios**:

1. **Given** an approved member whose roles intersect a downloadable resource, **When** they choose download, **Then** they receive the file via short-lived access issued after the server-side role check, and a `resource_downloaded` audit row exists with user, resource, timestamp, and IP.
2. **Given** a member whose roles do not intersect the resource, **When** they request download (including by id), **Then** they do not receive the file and no successful-download audit row is written.
3. **Given** any resource page or download response, **When** it is inspected, **Then** it does not contain a durable object-storage location for the file or the thumbnail.
4. **Given** short-lived access that has expired, **When** it is reused, **Then** the file is not served until the member passes the role check again and receives new access.
5. **Given** a Moderator, **When** they download a resource they can see for moderation, **Then** the download succeeds and is audit-logged the same way as a member download.

---

### User Story 4 - Files are scanned before anyone can download them (Priority: P1)

When an Admin uploads a file or a thumbnail (or replaces a file), the platform scans **both** for malware **before that publish or replace request completes**. A successful response means the resource is already downloadable for allowed members, with its required thumbnail. If **either** the main file **or** the thumbnail fails or cannot be scanned, the whole request fails: the admin is told it cannot be published (or the replace is rejected), rejected objects are **deleted from storage** (not left flagged for later), no storage key is kept that any download, thumbnail, or playback path could serve, the main file does not go live without a thumbnail, and members never see a pending or partial item. On a failed replace, the previously live file stays as it was. Scanner internals are not exposed to members.

**Why this priority**: PRD §8 and Constitution Principle III require a malware scan at ingest before a resource is downloadable. An unscanned file in the library is a defect.

**Independent Test**: Publish with a known-clean file and thumbnail and confirm the request succeeds only after both scans pass and members can then download. Publish (or replace) with a known-infected main file, and separately with a clean main file plus an infected thumbnail; confirm each request fails, rejected objects are gone from storage, no product path can serve them, no member-available resource (and no thumbnail-less live file) is left, a failed replace still serves the previous live file, and the admin sees a failure.

**Acceptance Scenarios**:

1. **Given** a complete upload of a clean file and thumbnail, **When** the publish request completes successfully, **Then** scanning has already succeeded, the resource is downloadable, and allowed members can fetch it.
2. **Given** a file that fails the scan or cannot be scanned, **When** the publish request finishes, **Then** the admin is told it cannot be published, no resource record exists, the rejected objects have been deleted from storage, and no product path can issue access to them.
3. **Given** a publish or replace request still in flight, **When** a member lists or downloads, **Then** they do not receive that not-yet-completed resource.
4. **Given** a file replacement, **When** the new file fails the scan, **Then** the replace request fails, the rejected new objects are deleted, members continue to receive the previously live file, and the resource identity is unchanged.
5. **Given** a clean main file and a thumbnail that fails the scan (or cannot be scanned), **When** publish or replace finishes, **Then** the whole request fails; both rejected objects are deleted; members do not receive the main file, a thumbnail-less listing, or a placeholder thumbnail.

---

### User Story 5 - Search, filter, and sort the library (Priority: P2)

A member on the library list can type a keyword (matched against title and preview text), narrow by tag chips and by source label, and sort by newest, most downloaded, or alphabetical title. Results never include resources outside their visibility, items from an in-flight or failed ingest, or soft-deleted items. An empty result set is an empty list, not an error.

**Why this priority**: Publishing is useless if members cannot find the right file among many (PRD §5.5). It depends on stories 1–4 already producing a visible, downloadable catalog.

**Independent Test**: Seed several visible resources with distinct titles, tags, sources, and download counts. As a Pathways member, search, filter, and sort; confirm LEAD-only items never appear in any combination.

**Acceptance Scenarios**:

1. **Given** resources whose titles or previews contain a keyword, **When** a member searches, **Then** only matching resources they are allowed to see appear.
2. **Given** tag chips and a source filter, **When** a member applies them, **Then** the list contains only resources that match those filters and their visibility.
3. **Given** sort options newest, most downloaded, and alphabetical, **When** a member selects each, **Then** the visible list is ordered accordingly.
4. **Given** filters that match nothing they can see, **When** the list renders, **Then** they see an empty library state, not another cohort’s items and not an existence leak.

---

### User Story 6 - Edit metadata or replace the file without changing identity (Priority: P2)

An Admin or Super Admin opens an existing resource, changes title, preview, thumbnail, source, tags, or visibility in place, or uploads a replacement file. The resource id stays the same so existing links keep working. A replacement file is scanned again in the same request before that request succeeds. The member detail page shows an updated last-updated date so people know the content is current. Edits write `resource_edited`.

**Why this priority**: Program materials change; republishing as a new item would break links and download history (PRD §5.5).

**Independent Test**: Create a resource, note its id, edit metadata, replace the file with a clean file, confirm the same id, new last-updated, members receive the new file, and an audit row exists. Confirm a Moderator cannot edit.

**Acceptance Scenarios**:

1. **Given** an existing resource, **When** an Admin changes metadata (including visibility), **Then** members see the new metadata on the next view, the id is unchanged, last-updated advances, and `resource_edited` is written.
2. **Given** an existing resource, **When** an Admin replaces the file with a clean file and the replace request succeeds, **Then** the scan has already passed, the id is unchanged, the new file is what allowed members receive, and last-updated advances.
3. **Given** a visibility change from shared to Pathways-only, **When** a LEAD member next lists or opens that id, **Then** the resource is withheld.
4. **Given** a Moderator or member, **When** they attempt an edit or replace, **Then** the resource is unchanged.

---

### User Story 7 - Withdraw a resource from member view (Priority: P2)

An Admin or Super Admin soft-deletes a resource. It disappears from every member list, detail, search, and download path. The file is not erased; it remains available for the audit retention period. Admins can still see that it was withdrawn in the admin workspace. The action writes `resource_deleted`. Members who had the id bookmarked get the same withholding as for a resource they were never allowed to see.

**Why this priority**: Staff must be able to pull material without destroying evidence (PRD §5.5, Constitution Principle II).

**Independent Test**: Soft-delete a previously visible resource. Confirm members no longer list, open, or download it (including by id). Confirm an audit row. Confirm the admin list still shows it as withdrawn. Confirm a Moderator cannot delete.

**Acceptance Scenarios**:

1. **Given** a visible downloadable resource, **When** an Admin soft-deletes it, **Then** it is absent from member list, search, detail, and download, and `resource_deleted` is written.
2. **Given** a soft-deleted resource, **When** a member requests its former id, **Then** they receive the same withholding as for a resource outside their visibility (no “this was deleted” reveal).
3. **Given** a soft-deleted resource, **When** an Admin or Super Admin opens the admin workspace, **Then** they can still see that the item was withdrawn; the stored file is not destroyed by this action.
4. **Given** a Moderator or member, **When** they attempt delete, **Then** the resource remains visible to allowed members.

---

### User Story 8 - Play a video in place (Priority: P3)

When the resource file is a video, the detail page offers an in-page player. The member can watch without being forced to download the whole file first. Playback is still allowed only after the same role check as download, uses short-lived access, and never publishes a durable storage location. A separate download control is not required for video; non-video types continue to use download.

**Why this priority**: Specified in PRD §5.5 edge cases; valuable once publishing and gating work, but the library is usable without it if videos are treated as downloadable files.

**Independent Test**: Publish a clean video visible to Pathways. As a Pathways member, play it on the detail page. As a LEAD member, confirm the page and playback are withheld. Confirm no durable storage URL is present.

**Acceptance Scenarios**:

1. **Given** a downloadable video resource the member may see, **When** they open the detail page, **Then** they can play it in the page without a forced full-file download.
2. **Given** a member who may not see that resource, **When** they request the page or playback access, **Then** they receive no video.
3. **Given** a non-video resource, **When** a member opens detail, **Then** they get download (story 3), not a video player.

---

### Edge Cases

- Upload interrupted before storage confirms: no resource row, no member-visible listing.
- Disallowed type or over 250 MB: rejected; no record.
- Infected or unscannable **main file or thumbnail** (including on replace): the whole publish/replace request fails; rejected objects are deleted from storage; no storage key is persisted that any later path could serve; members do not get a live main file without a thumbnail, a placeholder thumbnail, a flagged leftover object, or a durable pending-scan record. A failed replace leaves the previously live file unchanged.
- Publish or replace still in flight (scan not finished): no member-visible or downloadable resource from that attempt. After the request returns, there is no leftover “pending scan” state.
- Guessed resource id outside the user’s visibility, soft-deleted, or not yet downloadable: same withholding (empty/not-found), no cohort or existence leak.
- Client-supplied role header, query parameter, or body field: ignored.
- Expired short-lived access: file not served; member must pass the check again.
- Direct storage URL guessed or leaked: must not work as a public, durable download path for library files.
- Resource visible to multiple audiences: one record, visibility set controls who sees it.
- Soft-delete then download-by-id: denied for members; file retained for audit period.
- Visibility tightened after a member had the page open: the next list/detail/download follows the new set.
- Moderator can view/download all; publish/edit/delete still denied.
- Pending, denied, deactivated, invited, and signed-out: 0 library records.
- Empty catalog or filters that match nothing: empty state, not an error.
- Keyword search matches only preview text, not file contents.
- “Most downloaded” counts successful downloads of currently listed (visible, downloadable, not soft-deleted) resources.
- “Newest” is by original publish time; replacing a file updates last-updated on the detail page without pretending it is a newly published item.
- Administrative user with program role `none`: sees `all_authenticated` on member routes; manages all visibilities on admin routes (Admin/Super Admin only).
- Thumbnail and file are both required at publish; a file that is itself an image still needs a separate thumbnail.
- Analytics events for viewing or downloading a resource carry opaque user ids and role labels only — never names, emails, or file contents.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Super Admin and Admin MUST be able to create a resource with a file and required metadata: title, preview text (≤ 500 characters), thumbnail image, source label, visibility set, and optional free-form tags (0–10). Cites PRD §5.5, Appendix A.2.
- **FR-002**: Allowed file types MUST be PDF, DOCX, XLSX, PPTX, JPG, PNG, and MP4. Files larger than 250 MB MUST be rejected. Other types MUST be rejected.
- **FR-003**: Source label MUST be one of the launch vocabulary: Amend, Partner Org, External. It is required. Tags are free-form, at most 10, and MUST NOT be used as a substitute for visibility.
- **FR-004**: Visibility MUST be a set of one or more of `all_authenticated`, `pathways`, and `lead`. A user sees the resource if and only if any of their roles intersects that set. Resources visible to multiple audiences MUST be stored once. Cites PRD §4, Constitution Principle I.
- **FR-005**: This slice MUST reuse the `002-auth-rbac` authorization mechanism. It MUST NOT invent a parallel permission model, a new visibility vocabulary, or trust a role claim from the client.
- **FR-006 (layer 1)**: Member library routes (`/app/resources`, `/app/resources/[id]`) MUST require a session. Admin resource routes (`/admin/resources`, `/admin/resources/new`, `/admin/resources/[id]`) MUST require a session and MFA-satisfied. Unauthenticated requests MUST NOT return resource data.
- **FR-007 (layer 2)**: Every server path that returns or mutates resource data MUST call `requireRole` (or the equivalent named helper from `002-auth-rbac`) **before** returning data. Role MUST come from the signed session. The helper MUST NOT be mocked in tests whose purpose is to verify the role check.
- **FR-008 (layer 3)**: The resource table MUST carry the same visibility set as Constitution Principle I, with queries including role-based filters **and** native database row-level security enabled. That policy layer MUST NOT depend on a managed-database vendor. Soft-deleted rows MUST be withheld from members at this layer as well.
- **FR-009**: Upload, edit, file replace, and soft-delete MUST be allowed only for Super Admin and Admin. Moderator, Pathways, LEAD, pending, and invited MUST be denied those mutations. Cites PRD §3.
- **FR-010**: View shared resources MUST be allowed for Super Admin, Admin, Moderator, Pathways, and LEAD, and denied for pending and invited. View role-specific resources MUST follow the matrix: members see only their program’s items; Moderators see all for moderation; pending and invited denied.
- **FR-011**: Download MUST be allowed only for users who can view that resource, only when the resource is downloadable (scan passed, not soft-deleted). Every successful download MUST write `resource_downloaded` (actor user id, resource id, timestamp, IP) in the same transaction as the access grant, using the existing append-only audit writer. Cites PRD §5.5, §6.
- **FR-012**: Downloads (and video playback access, and thumbnails) MUST be issued as short-lived access **after** the server-side role check. Durable object-storage locations MUST NEVER be exposed in pages, responses, or emails. Cites Constitution Principle III, PRD §5.5.
- **FR-013**: Every uploaded file, replacement file, and thumbnail MUST be scanned for malware **synchronously in the same publish or replace request**. That request MUST NOT complete successfully until **both** scan results are known. Success MUST mean the resource is already downloadable **and** has its required thumbnail. If the main file **or** the thumbnail fails or cannot be scanned, the **whole** request MUST fail (not published, or replace rejected): the main file MUST NOT go live without a thumbnail, and a placeholder thumbnail MUST NOT be substituted. There MUST NOT be a durable pending-scan resource, an async scan worker, or an admin notification that a later scan finished. Cites PRD §8, Constitution Principle III.
- **FR-014**: Creation MUST be atomic with respect to member visibility: a failed or incomplete upload or scan MUST NOT leave a partial resource that members can see or download.
- **FR-015**: The member list MUST support keyword search over title and preview text, filter by tag and by source label, and sort by newest, most downloaded, and alphabetical title. Search and filters MUST NOT return resources outside the user’s visibility, items from an in-flight or failed ingest, or soft-deleted items.
- **FR-016**: Admins MUST be able to edit metadata in place and replace the file while preserving the resource id. Replacement MUST re-run FR-013 in the same request; the replace MUST NOT succeed until the new file is downloadable. The member detail page MUST show a last-updated date.
- **FR-017**: Soft-delete MUST hide the resource from all member views and downloads while retaining the file for the audit period. Member-facing withholding MUST NOT announce that the item was deleted. The action MUST write `resource_deleted`.
- **FR-018**: This slice MUST emit `resource_created`, `resource_edited`, `resource_deleted`, and `resource_downloaded` through the existing audit writer. Rows remain append-only. Cites PRD §6.
- **FR-019**: Video files MUST be playable on the detail page without forcing a full download; playback MUST use the same role check and short-lived access rules as FR-012.
- **FR-020**: CSRF protection MUST apply to every state-changing resource request. Cites PRD §8.
- **FR-021**: Product analytics for this slice (including resource viewed / downloaded) MUST receive opaque user ids and role labels only. Names, emails, DOC affiliation, titles, and file contents MUST NEVER appear. Cites Constitution Principle II, PRD §2.
- **FR-022**: Hostnames, bucket names, regions, and connection strings MUST come from environment variables only. The slice MUST run locally with no production-host dependency. Cites Constitution Principle III.
- **FR-023**: Every row of the PRD §3 permission matrix for **View shared resources**, **View role-specific resources**, **Download resources**, and **Upload / edit / delete resources** MUST be asserted. The matrix MUST run twice: through the application, and directly against the database with the application bypassed. Other capabilities remain fail-closed if not implemented here. Cites Constitution Principle IV.
- **FR-024**: Every route handler delivered in this slice MUST have a test that it rejects an unauthorized role, not only that it accepts an authorized one.
- **FR-025**: Secrets, storage credentials, and signed-access material MUST NEVER appear in Git, recoverable test fixtures, or log lines.
- **FR-026**: Objects that fail or cannot complete the malware scan MUST be **deleted from object storage**. The product MUST NOT leave them flagged, unreferenced, or quarantined in a state any download, thumbnail, or playback path could later serve. A failed **publish** MUST NOT persist a resource record or storage keys. A failed **replace** MUST delete only the rejected new objects, MUST NOT persist new keys, and MUST leave the previously live file unchanged. Soft-delete retention (FR-017) applies only to files that were successfully published, then withdrawn.

### Key Entities

- **Resource**: A single published program file and its metadata (title, preview text, thumbnail, source label, tags, visibility set, uploader, created/updated, optional soft-delete time). Downloadable only after a successful malware scan. Identity is stable across metadata edits and file replacement.
- **Visibility set**: `all_authenticated` | `pathways` | `lead` (one or more). Same contract as `002-auth-rbac`; first product table that uses it.
- **Uploaded file**: The payload members download or play (type and size constrained as in FR-002), held in private storage and reached only via short-lived, role-checked access. Scan-failed ingest objects are deleted; they are not retained as unreferenced blobs.
- **Thumbnail**: Required preview image for list and detail; same access rules as the file (no public storage URL). A failed thumbnail scan fails the entire ingest; a live resource never lacks a thumbnail.
- **Audit log**: Existing append-only store; this slice adds the four resource content events.

### Constraints (mandated by PRD §5.5 / §3 / §4 / §6 / §8 and Constitution; not open design)

This slice does not re-open authentication, authorization, storage-wrapper, or hosting choices. Plan and tasks MUST reuse `002-auth-rbac` sessions, `requireRole` from the signed session, native database row-level security on the resource table, and the append-only audit writer. Object-storage access MUST go through the existing single storage wrapper; downloads MUST be short-lived signed URLs issued only after the role check. Uploaded files MUST be scanned by the local ClamAV daemon **before the publish/replace request completes and before** a resource is marked downloadable (locally, tests MUST still prove clean vs infected outcomes against that ingest contract). Scan-failed objects MUST be deleted from storage, not left for a later code path to sign. Do not introduce a new authorization library, a managed-database proprietary policy layer, client-supplied roles, or direct bucket URLs in the product.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An MFA-satisfied Admin can publish a complete resource (file + required metadata + visibility) in under 3 minutes excluding file-transfer time for a small fixture file.
- **SC-002**: 100% of unauthorized attempts in the four PRD §3 resource capabilities are denied on both the application run and the application-bypassed database run. Zero cross-role resource leaks in those runs.
- **SC-003**: A Pathways member sees 0 LEAD-only resources in list, search, detail, and download; a LEAD member sees 0 Pathways-only resources; both see shared (`all_authenticated`) resources.
- **SC-004**: Pending members, invited token holders, and signed-out visitors receive 0 resource records from library routes.
- **SC-005**: 100% of successful member downloads in the test set produce exactly one new `resource_downloaded` audit row with user, resource, time, and IP; existing audit rows cannot be changed through any product path.
- **SC-006**: 100% of download and thumbnail responses in the test set omit durable storage locations; expired short-lived access fails in 100% of reuse attempts.
- **SC-007**: 100% of known-infected (or scan-failed) publish/replace requests — including clean main file + failed thumbnail — fail before completion, leave 0 member-available resources (0 thumbnail-less live files), persist 0 storage keys for the rejected objects, and leave 0 rejected objects in storage that any product path can serve; a failed replace continues to serve the previous live file in 100% of tests; 100% of successful known-clean publish/replace requests return only after **both** scans have succeeded and the resource is already downloadable with its thumbnail.
- **SC-008**: After soft-delete, 100% of member list/search/detail/download attempts for that id withhold the resource; the admin workspace still shows it as withdrawn.
- **SC-009**: A member can locate a known visible resource by title keyword, then by tag, then by source, and can reorder by newest, most downloaded, and alphabetical, in under 1 minute, with 0 results outside their visibility.
- **SC-010**: File replacement preserves resource identity in 100% of tested replaces; members who may see it receive the new file after a clean scan; last-updated on the detail page changes.
- **SC-011**: Moderators succeed at 0 publish, edit, replace, or delete attempts; they can still view and download resources of every visibility for moderation.
- **SC-012**: Product analytics payloads for this slice contain 0 names, emails, DOC affiliations, titles, or file contents.
- **SC-013**: A developer following local steps can publish, browse by role, download, fail a scan, search, edit, replace, and soft-delete against a local database and environment-configured storage with no production host.

## Assumptions

Named assumptions below are **recorded**, not silent. Constitution v1.0.0 requires this for PRD §11 dependencies.

### PRD §11 dependencies

| Question | Relevance to this slice | Decision in this spec |
| --- | --- | --- |
| **Q3** Network name list | Visibility tokens and who sees role-specific resources | **Proceed** on **Pathways and LEAD only**, same as `002-auth-rbac`. Visibility remains `all_authenticated \| pathways \| lead`. **Revisit** if Amend adds networks — RLS and filters would expand. |
| **Q6** Email provider | No resource-library notification emails are specified | **Not required.** This slice does not send mail. |
| **Q7** Retention / funder commitments | Soft-deleted files “remain for audit period” vs scan-failed ingest | **Proceed** on PRD defaults (7y security / 3y other) as **policy for successfully published files**. A retention-sweep job that physically deletes those objects is **out of scope**; soft-delete MUST NOT erase a published file. **Scan-failed ingest is not that case:** rejected objects MUST be deleted (FR-026), not retained for the audit period. |
| **Q8** FERPA / HIPAA / state regime | Files may incidentally contain sensitive program material | **Proceed** on the PRD preliminary read (neither FERPA nor HIPAA directly). Still: no PII to analytics, no public storage URLs, full download audit. |
| **Q13** Data residency | Where files live in production | **Not a hosting decision in this slice.** Local/dev uses environment-configured private storage. Production residency remains gated by infrastructure work / ADR-0001. |
| **Q17–Q20** Operational ownership | Who runs the malware daemon and storage in production | **Not a dependency for local proof.** Production daemon and bucket provisioning stay infrastructure. This slice owns the application ingest gate and the signed-access path. |

### Other assumptions

- **Authorization reuse**: The representative visibility-gated record in `002-auth-rbac` proved the contract. This slice’s Resource table is the first production content table on that contract. Moderators see both program visibilities for moderation, matching `002-auth-rbac` Assumptions.
- **Source labels**: PRD §5.5 gives examples (Amend, Partner Org, External). This slice treats those three as a **closed list**, not admin-managed vocabulary CRUD.
- **Newest vs last-updated**: List sort “newest” uses original publish time. File replace and metadata edit advance last-updated on the detail page only.
- **Most downloaded**: Count of successful `resource_downloaded` events for resources the current user is allowed to see and that are still listed (downloadable, not soft-deleted).
- **No restore UI**: Soft-delete has no member-facing undo and no dedicated restore workflow in this slice. Admins can still see withdrawn items. Re-publishing is a new resource if needed.
- **Synchronous ingest (clarified 2026-08-17)**: The admin waits in the publish/replace request until the scan result is known. There is no durable pending-scan state and no later admin notification. Members never see an in-flight or failed ingest. Admins see the success or failure on that request.
- **Thumbnail scanning (clarified 2026-08-17)**: Thumbnails are uploaded files and follow the same synchronous malware-scan rule as the main file. A failed or unscannable thumbnail **blocks the whole resource**; the main file does not publish or replace without it.
- **Rejected ingest objects (clarified 2026-08-17)**: Scan-failed files and thumbnails are **deleted from storage**. They are not flagged, unreferenced, or quarantined. No product path can later issue access. A failed replace deletes only the new rejected objects and keeps the previously live file.
- **Video**: MP4 only for in-page play; other types use download. Playback access is equivalent to a gated fetch, not a public stream.
- **Local scan and storage**: Local and CI MUST be able to assert clean vs infected ingest without a production host. Production uses the on-host ClamAV daemon required by the constitution. Storage credentials and bucket names remain environment variables.
- **Home dashboard**: “Recent resources” on `/app` is out of scope; members reach the library at `/app/resources` (primary nav already listed in the PRD).
- **Keyword search**: Title and preview only; no full-text of file bytes (semantic search is out of scope).
- English-only UI; local session/MFA conventions from `002-auth-rbac` still apply.
