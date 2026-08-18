# Feature Specification: Member Directory

**Feature Branch**: `007-member-directory`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Start slice 007-member-directory (PRD §5.6). Cover: searchable directory (name, title, DOC affiliation if visible, network), opt-in visibility default per assumptions-log.md (Q12), field-level privacy toggles (DOC affiliation, title, email show/hide), same-program-only visibility (Pathways sees Pathways, LEAD sees LEAD, admins see all), rate-limited search, profile view audit event. Reuse visibility pattern and three-layer authorization from prior slices. Proceeds on Q2 and Q12 assumptions per docs/decisions/assumptions-log.md — unconfirmed by Amend, name this dependency in spec.md."

**Cites**: PRD v1.1 §2 (directory search and directory profile viewed instrumentation), §3 (View directory / Appear in directory), §4 (authorization model, role tokens), §5.6 (member directory and compliance notes), §6 System 1 (`directory_privacy_changed`, `directory_profile_viewed`) and System 2 (product analytics; no PII), Appendix A.1 (User directory fields), Appendix A.4 (DirectoryProfileView), Appendix B.2 (`/app/directory`, `/app/directory/[user_id]`, `/app/profile/privacy`); Constitution v1.0.0 Principles I, II, III, IV, V; `002-auth-rbac` three-layer authorization and role tokens; `003-registration-invitation-approval` for Active members, encrypted DOC affiliation, and network list; `004-resource-library`, `005-announcements`, and `006-event-calendar` as prior slices on the same authorization contract. **PRD §11 Q2 and Q12** — proceeds on named assumptions in `docs/decisions/assumptions-log.md`; **unconfirmed by Amend**.

## Scope

This slice delivers a **searchable, privacy-gated member directory**. Active Pathways members see only opted-in Pathways members. Active LEAD members see only opted-in LEAD members. Super Admin, Admin, and Moderator see opted-in members of both programs. Members are **not listed until they opt in**. When listed, name and network are always shown; DOC affiliation, title, and email appear only when that member has turned that field on. Search is rate-limited. Opening another member’s directory profile writes a profile-view audit event.

Directory rows are **people**, not a content table with a `visibility` set on a resource. The **same three-layer authorization** and **same program-role tokens** (`pathways` | `lead`, plus staff seeing both) MUST be reused. This slice MUST NOT invent a second permission model, a new role vocabulary, or a client-supplied role. Same-program listing is the directory application of Constitution Principle I’s intersection rule: a member is shown to a viewer if and only if the viewer’s allowed tokens include that member’s program role (staff tokens include both programs).

This slice **includes field-level privacy toggles**. It does **not** take the PRD §11 optional deferral that would ship overall opt-in only and leave field toggles to a later phase.

**In scope**

- Member directory list and search at `/app/directory` by name, title (only if that member shows title), DOC affiliation (only if that member shows DOC affiliation), and network
- Directory profile at `/app/directory/[user_id]` showing only fields the subject has made visible (name and network always, when the profile is listed)
- Overall directory opt-in, default **off** (not listed until the member turns it on), with plain-language explanation of who can see the profile and which fields
- Field-level show/hide for DOC affiliation, title, and email
- Privacy controls at `/app/profile/privacy` (and a clear prompt in the post-approval member experience so opt-in is not buried)
- Optional avatar; otherwise initials on the brand color
- Same-program listing for Pathways and LEAD; Super Admin, Admin, and Moderator see all opted-in Active members
- Search rate limit: 30 directory searches per minute per signed-in user
- Audit: `directory_privacy_changed`, `directory_profile_viewed` (viewer and viewed identifiers)
- Product analytics: directory search, directory profile viewed — opaque user ids and role labels only
- Immediate removal of deactivated members from results regardless of prior opt-in
- Permission-matrix proofs for **View directory** and **Appear in directory** in PRD §3, run both through the application and with the application bypassed

**Out of scope**

- Sign-in, sessions, MFA, `requireRole`, the audit writer, encryption helpers, the DOC affiliation controlled list, networks, and the analytics tracker themselves (already prior slices; this slice **consumes** them)
- Registration, invitation, and approval (`003`) except consuming Active members and their stored name, title, encrypted DOC affiliation, email, and network
- Resource library, events, announcements, forum, WordPress feed
- In-directory messaging, introductions, or “connect” beyond viewing a profile
- Staff tools to force another member on or off the directory (no directory moderation UI in this slice)
- Changing the DOC affiliation **list** (already `003`); this slice only displays a person’s current label when that field is visible
- Public or unauthenticated directory pages
- Pending, invited, denied, or deactivated people appearing or searching
- Admin analytics dashboards (this slice writes the events those views will use later)
- A new authorization mechanism, a second role vocabulary, or client-supplied roles
- Production host provisioning

## Clarifications

### Session 2026-08-17

- Q: When a listed member hides DOC affiliation, should a search for that affiliation still return them (with the field blank), or must a hidden field be ignored for matching so they do not appear in those results? → A: Hidden fields are excluded from matching. A search for that DOC affiliation (or a hidden title) does not return that member. They can still appear when the query matches a visible field (name or network, or a field they have shown).
- Q: Do the show/hide controls for DOC affiliation, title, and email hide those fields from every directory viewer (including same-program members and staff), or do they depend on who is looking? → A: Uniform hide. DOC affiliation, title, and email are hidden from all directory viewers (same-program members and Super Admin / Admin / Moderator). Only the member sees those values on their own privacy and profile-edit screens. Toggles are not per-viewer.

## User Scenarios & Testing *(mandatory)*

Primary actors: **Pathways member**, **LEAD member**, **Admin**, **Super Admin**, **Moderator**. **Pending members**, **invited token holders**, and **signed-out visitors** must be refused without leaking whether a person is listed.

### User Story 1 - Opt in and set field-level privacy (Priority: P1)

An Active Pathways or LEAD member opens privacy settings. They are **not** in the directory until they turn on listing. The screen explains, in plain language, who would see them (same-program members, plus staff who can view the directory) and that name and network show whenever they are listed, while DOC affiliation, title, and email each have their own show/hide control. Those three toggles are **not per-viewer**: hiding a field hides it from every directory viewer, including same-program members and staff. Defaults: listing off; DOC affiliation, title, and email hidden. After they opt in and choose fields, directory viewers see only what they allowed. The member still sees their own values on privacy and profile-edit screens. Changing listing or a field toggle writes `directory_privacy_changed`.

**Why this priority**: Opt-in default and field-level hiding are the compliance core of PRD §5.6. Search is unsafe without them.

**Independent Test**: Create two Active Pathways members. Leave A opted out; opt B in with title on and DOC/email off. Confirm A does not appear for another Pathways member; B appears with name, network, and title, and without DOC affiliation or email. Confirm a pending user cannot open privacy in a way that lists them.

**Acceptance Scenarios**:

1. **Given** a newly Active Pathways or LEAD member who has never changed directory privacy, **When** another allowed viewer searches the directory, **Then** that new member is not listed.
2. **Given** an Active member, **When** they turn listing on at `/app/profile/privacy`, **Then** they appear to allowed viewers with name and network, and `directory_privacy_changed` is written (no DOC affiliation, email, or name values in that record’s extra data).
3. **Given** a listed member, **When** they hide title, DOC affiliation, or email, **Then** every directory viewer (same-program members and Super Admin / Admin / Moderator) no longer sees that field on the directory profile or in search results, and `directory_privacy_changed` is written.
4. **Given** a listed member, **When** they show DOC affiliation, title, or email, **Then** every directory viewer who is allowed to see that listing sees that field, using the current DOC list label for affiliation (not a typed-in string).
5. **Given** a listed member, **When** they turn listing off, **Then** they disappear from all directory results immediately and `directory_privacy_changed` is written.
6. **Given** a pending, invited, or signed-out visitor, **When** they request privacy or directory surfaces, **Then** they are denied and no other member’s directory data is returned.
7. **Given** a listed member with DOC affiliation hidden, **When** a Super Admin, Admin, or Moderator opens that directory profile, **Then** they do not see DOC affiliation (staff listing of both programs does not override field hide).

---

### User Story 2 - Search the same-program directory (Priority: P1)

A signed-in Active Pathways member opens `/app/directory` and searches by name, title, DOC affiliation, or network. Results include only Active, opted-in Pathways members. Hidden fields are not shown and **cannot be used to find** that person (a search for a hidden DOC affiliation or hidden title does not return them). A LEAD member sees only opted-in LEAD members. Pending users see none.

**Why this priority**: Finding peers in the same program is the member-facing value of PRD §5.6.

**Independent Test**: Seed opted-in Pathways and LEAD members with mixed field toggles. Confirm Pathways search returns only Pathways; LEAD only LEAD; a title-hidden member is not found by title; a DOC-hidden member is not found by affiliation; pending sees zero.

**Acceptance Scenarios**:

1. **Given** an Active Pathways member and an opted-in Active Pathways member, **When** the first searches a matching visible name, title, DOC affiliation, or network, **Then** the second appears in results.
2. **Given** an Active Pathways member and an opted-in Active LEAD member, **When** the Pathways member opens the directory or searches, **Then** the LEAD member is not shown and their existence is not announced.
3. **Given** a listed member with title hidden, **When** a same-program member searches that title, **Then** that member is not returned — including as a result with title blanked.
4. **Given** a listed member with DOC affiliation hidden, **When** a same-program member (or staff) searches that affiliation label, **Then** that member is not returned — including as a result with DOC affiliation blanked. Matching a hidden value is forbidden; blanking the field in the result is not a substitute.
5. **Given** a listed member with DOC affiliation hidden and a unique visible name, **When** a same-program member searches that name, **Then** the member is returned and DOC affiliation is omitted from the row (name match is allowed; hidden-field match is not).
6. **Given** a pending member, invited holder, or signed-out visitor, **When** they request the directory, **Then** they receive no member records.

---

### User Story 3 - Open a directory profile (Priority: P1)

A member who can see someone in search opens `/app/directory/[user_id]`. They see name, network, optional avatar or initials, and only the fields that member has shown. If they are not allowed to see that person (other program, opted out, deactivated, pending), the product withholds the profile the same way it withholds other role-gated content — no confirmation that the person exists. A successful view writes `directory_profile_viewed` with viewer and viewed identifiers and records directory profile viewed analytics (opaque ids and role labels only).

**Why this priority**: Connection requires a profile, and PRD §5.6 / §6 require a recorded profile view.

**Independent Test**: Opt in a Pathways member with email on and DOC off. Confirm a Pathways peer sees name, network, email, no DOC; a LEAD member is withheld; opening the allowed profile writes the audit event.

**Acceptance Scenarios**:

1. **Given** a viewer allowed to see an opted-in member, **When** they open that directory profile, **Then** they see name, network, avatar or initials, and only shown optional fields, and `directory_profile_viewed` is written with viewer and viewed identifiers (no names, emails, or DOC affiliation in extra data).
2. **Given** a viewer not allowed to see that member (other program, opted out, deactivated, pending subject), **When** they request that profile, **Then** they are withheld the same as other missing role-gated content and no profile-view audit for a successful view is written.
3. **Given** a successful profile view, **When** product analytics is recorded, **Then** the payload has opaque user ids and role labels only.

---

### User Story 4 - Staff see all opted-in members (Priority: P2)

An MFA-satisfied Super Admin, Admin, or Moderator opens the member directory and sees opted-in Active members of **both** Pathways and LEAD. Field-level hide still applies to staff: they do not see DOC affiliation, title, or email unless that member has shown that field. They cannot make a pending or deactivated person appear. Appear-in-directory remains a member choice; this slice does not add a staff override of listing or of field toggles.

**Why this priority**: PRD §3 gives staff View directory without same-program limits; members still control listing and fields.

**Independent Test**: Opt in one Pathways and one LEAD member. Confirm Admin sees both; a Pathways member still sees only Pathways.

**Acceptance Scenarios**:

1. **Given** an MFA-satisfied Super Admin, Admin, or Moderator, **When** they open `/app/directory`, **Then** opted-in Active Pathways and LEAD members are both listed, and hidden DOC affiliation, title, and email are omitted for staff just as for members.
2. **Given** staff, **When** they search, **Then** the same 30-per-minute limit applies as for members.
3. **Given** staff, **When** they open an allowed profile, **Then** `directory_profile_viewed` is written as for members.

---

### User Story 5 - Rate-limited search (Priority: P2)

A signed-in user who can view the directory may run at most 30 directory searches in any 60-second window. Further attempts are refused with a generic “try again later” outcome that does not reveal whether matches exist. The limit is per user, not shared across users.

**Why this priority**: PRD §5.6 names this limit to discourage scraping of a sensitive cohort.

**Independent Test**: As one member, issue 30 searches then an immediate 31st; confirm the 31st is refused with no result list. Confirm a second member can still search.

**Acceptance Scenarios**:

1. **Given** a user who has already performed 30 directory searches in the current minute, **When** they search again, **Then** no result list is returned and they are told to try later.
2. **Given** two different allowed users, **When** each searches 30 times, **Then** both succeed up to their own 30; neither consumes the other’s allowance.

---

### Edge Cases

- Deactivated members disappear from list, search, and profile immediately, even if they had opted in.
- Denied, pending, and invited people never appear and cannot search.
- A member with an administrative role and a program role is listed only if they opted in; staff with no program role do not appear (PRD §3 Appear in directory is N/A for Super Admin / Admin / Moderator).
- Searching by email is not a directory search field; email is shown on a profile only when that member has shown email.
- Hidden-field oracle: a search MUST NOT return a member because a hidden DOC affiliation or hidden title matched, even with that field omitted in the result. That would reveal the hidden value. The member MAY still appear if the same query also matches a visible field (name, network, or a shown title/DOC affiliation).
- Field hide is uniform, not per-viewer: Super Admin, Admin, and Moderator MUST NOT see a hidden DOC affiliation, title, or email on directory list, search, or profile. The member still sees those values on `/app/profile/privacy` and profile-edit. Opening their own `/app/directory/[user_id]` MUST show the same field set any other allowed viewer would see (preview of the public listing).
- Empty or whitespace search returns the allowed opted-in set (still rate-limited as a search).
- DOC list label is edited after a member selected it: viewers who may see DOC affiliation see the **current** label, not a stale spelling.
- Member has no title stored: title does not appear even if the title toggle is on; search by title does not match them.
- Request for a directory profile id that the viewer must not see: same withholding as a missing role-gated page; do not announce “hidden” vs “unknown.”
- Rate-limit window: the 31st search inside 60 seconds fails closed; after the window, search works again.
- Avatar missing: initials on brand color, consistent across the directory.
- Analytics and audit extra data: never names, emails, titles, DOC affiliation labels, or search query text.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Active Pathways and LEAD members MUST be able to turn directory listing on or off. Default MUST be off (not listed) until they opt in. Cites PRD §5.6, §3 Appear in directory, assumptions-log Q12.
- **FR-002**: Privacy settings MUST explain in plain language who can see a listed profile (same-program members; Super Admin, Admin, and Moderator see all listed members) and that name and network are shown whenever the profile is listed. Cites PRD §5.6 compliance note.
- **FR-003**: Each listed member MUST have independent show/hide controls for DOC affiliation, title, and email. Defaults for those three MUST be hidden. Name and network MUST be visible whenever the overall listing is on. These toggles are **uniform, not per-viewer**: a hidden field MUST be omitted for every directory viewer, including same-program members and Super Admin / Admin / Moderator. The member MUST still see their own values on privacy and profile-edit screens. Cites PRD §5.6; Clarifications 2026-08-17. This slice MUST ship these field toggles (it MUST NOT defer them per the PRD §11 scope-reduction list).
- **FR-004**: DOC affiliation shown in the directory MUST be the current label from the admin-managed controlled list already used at registration — not free text typed for the directory. Cites PRD §11 Q2, assumptions-log Q2, `003-registration-invitation-approval`.
- **FR-005**: Directory search MUST support name, title, DOC affiliation, and network. A hidden title or hidden DOC affiliation MUST be fully excluded from search matching for that member: the query MUST NOT return them because the hidden value matched, including as a hit with that field blanked. They MAY still appear when the query matches a visible field (name, network, or a field they have shown). Email MUST NOT be a search field. Cites PRD §5.6; Clarifications 2026-08-17.
- **FR-006**: Directory results MUST include only Active members who have opted in. Pending, invited, denied, and deactivated members MUST NEVER appear, regardless of prior opt-in. Cites PRD §5.6, §3.
- **FR-007**: A Pathways member MUST see only Pathways members in the directory. A LEAD member MUST see only LEAD members. Super Admin, Admin, and Moderator MUST see listed members of both programs. Cites PRD §5.6, §3 View directory.
- **FR-008**: This slice MUST reuse the `002-auth-rbac` authorization mechanism and the same program-role tokens as prior content slices (`pathways` | `lead`; staff see both). It MUST NOT invent a parallel permission model, a new visibility vocabulary, or trust a role claim from the client. Same-program listing is the intersection of the viewer’s tokens with the subject’s program role. Cites Constitution Principle I, PRD §4.
- **FR-009 (layer 1)**: Member directory surfaces (`/app/directory`, `/app/directory/[user_id]`, `/app/profile/privacy`) MUST require a session. Unauthenticated requests MUST NOT return directory data.
- **FR-010 (layer 2)**: Every server path that returns or mutates directory or privacy data MUST call `requireRole` (or the equivalent named helper from `002-auth-rbac`) **before** returning data. Role MUST come from the signed session. The helper MUST NOT be mocked in tests whose purpose is to verify the role check.
- **FR-011 (layer 3)**: Queries that list or fetch other members for the directory MUST include role-based filters **and** native database row-level security so that same-program (or staff) rules still hold if layer 2 is missed. That policy layer MUST NOT depend on a managed-database vendor. Cites Constitution Principles I and IV.
- **FR-012**: View directory MUST be allowed for Super Admin, Admin, and Moderator (both programs), role-scoped for Pathways and LEAD, and denied for pending and invited. Cites PRD §3.
- **FR-013**: Appear in directory MUST be possible only for Active Pathways and LEAD members who opt in. Pending and invited MUST NOT appear. Staff-only accounts (no program role) MUST NOT appear. Cites PRD §3.
- **FR-014**: Opening a directory profile the viewer is not allowed to see MUST withhold the record without announcing whether the person exists, is opted out, or is in another program. Cites Constitution Principle I, PRD §8 (no account-state leakage).
- **FR-015**: An avatar is optional. When absent, the directory MUST show a consistent initials treatment using brand color. Cites PRD §5.6.
- **FR-016**: Directory searches MUST be limited to 30 per minute per signed-in user. Excess attempts MUST be refused without returning a result list and MUST NOT reveal whether matches exist. Cites PRD §5.6.
- **FR-017**: This slice MUST emit `directory_privacy_changed` when listing or a field toggle changes, and `directory_profile_viewed` when a viewer successfully opens another member’s directory profile, through the existing append-only audit writer. Rows remain append-only. Viewer and viewed identifiers only; no PII in extra data. Cites PRD §6.
- **FR-018**: When a member performs a directory search they are allowed to run, the product MUST record `directory search`. When they successfully open a directory profile, the product MUST record `directory profile viewed`. Cites PRD §2, §6.
- **FR-019**: Product analytics for this slice MUST receive opaque user ids and role labels only. Names, emails, DOC affiliation, titles, networks as free text, search query strings, and profile copy MUST NEVER appear. Cites Constitution Principle II, PRD §2 / §6.
- **FR-020**: DOC affiliation remains PII: encrypted at rest; never sent to analytics; shown on directory surfaces only when that member is listed **and** has shown the field. Staff directory views MUST follow the same rule. Cites PRD §5.2 / §5.6 compliance notes, Constitution II; Clarifications 2026-08-17.
- **FR-021**: CSRF protection MUST apply to every state-changing privacy request. Cites PRD §8.
- **FR-022**: Every row of the PRD §3 permission matrix for **View directory** and **Appear in directory** MUST be asserted. The matrix MUST run twice: through the application, and directly against the database with the application bypassed. Other capabilities remain fail-closed if not implemented here. Cites Constitution Principle IV.
- **FR-023**: Every route handler delivered in this slice MUST have a test that it rejects an unauthorized role, not only that it accepts an authorized one.
- **FR-024**: Secrets MUST NEVER appear in Git, recoverable test fixtures, or log lines. Hostnames and connection strings MUST come from environment variables only. Cites Constitution Principle III.
- **FR-025**: Directory list, search, profile, and privacy controls MUST meet WCAG 2.1 AA for this surface: targets at least 44×44 CSS pixels, a name for every control, search operable by keyboard, and no motion that ignores reduced-motion. Cites Constitution Principle V.

### Key Entities

- **Member directory listing**: Whether an Active Pathways or LEAD member is findable by allowed viewers. Default off.
- **Field visibility**: Independent show/hide for DOC affiliation, title, and email. Applied the same way to every directory viewer (not per-viewer). Name and network are not hideable while listed. The subject still sees stored values on privacy and profile-edit.
- **Directory profile**: The view another allowed person sees: name, network, optional avatar or initials, and any shown optional fields.
- **DOC affiliation (person)**: The member’s selection from the admin-managed list (Q2). PII; encrypted; directory shows the current list label only when that field is shown.
- **Audit log**: Existing append-only store; this slice uses `directory_privacy_changed` and `directory_profile_viewed`.
- **Analytics events**: Existing opaque tracker; this slice adds directory search and directory profile viewed.

### Constraints (mandated by PRD §5.6 / §3 / §4 / §6 and Constitution; not open design)

This slice does not re-open authentication, authorization, hosting, or the DOC list. Plan and tasks MUST reuse `002-auth-rbac` sessions, `requireRole` from the signed session, native database row-level security on member rows used for directory read, the append-only audit writer, and existing encryption for DOC affiliation (and other PII columns already encrypted). Directory search and profile-view recording MUST go through the existing analytics helper (opaque ids and role labels only; extra/PII fields rejected). Do not introduce a new authorization library, a managed-database proprietary policy layer, client-supplied roles, or a second role vocabulary. Rate limiting is an application rule (30 searches per user per minute); it does not replace the three authorization layers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly Active member who has not opted in appears in **0** directory results for every allowed viewer.
- **SC-002**: After opt-in, 100% of same-program allowed viewers can find that member by a visible name; 100% of other-program members (non-staff) see 0 results for that member.
- **SC-003**: 100% of unauthorized attempts in the two PRD §3 directory capabilities are denied on both the application run and the application-bypassed database run. Zero cross-program member leaks in those runs for non-staff viewers.
- **SC-004**: Pending members, invited token holders, and signed-out visitors receive 0 directory records.
- **SC-005**: When title, DOC affiliation, or email is hidden, 100% of directory viewers (same-program members and Super Admin / Admin / Moderator) see that field on neither the result row nor the directory profile. A search that matches only the hidden title or hidden DOC affiliation returns 0 hits for that member (not a blanked row). A search that matches a visible name still returns them, with the hidden field omitted. The member still sees the stored value on privacy and profile-edit.
- **SC-006**: When listing is on, 100% of allowed viewers see name and network on the profile.
- **SC-007**: Super Admin, Admin, and Moderator are shown opted-in members of both programs in one directory; a Pathways member is shown 0 LEAD-only listings; a LEAD member is shown 0 Pathways-only listings.
- **SC-008**: Deactivating a listed member removes them from 100% of subsequent list, search, and profile views.
- **SC-009**: The 31st directory search by the same user inside one minute returns 0 result rows and a try-later outcome; a second user is not blocked by the first user’s count.
- **SC-010**: 100% of successful other-member profile views in the test set write `directory_profile_viewed` with viewer and viewed identifiers and 0 names, emails, or DOC affiliation values in extra data.
- **SC-011**: 100% of directory search and directory profile viewed analytics payloads in the test set contain 0 names, emails, DOC affiliations, titles, or search query strings.
- **SC-012**: An Active member can turn listing on, set the three field toggles, appear to a same-program peer, and hide again, in under 2 minutes on a phone-width screen.
- **SC-013**: A developer following local steps can opt in, search by the four allowed fields, open a profile, prove same-program isolation, prove staff see both programs, hit the search cap, and see audit rows — against a local database with no production host.

## Assumptions

Named assumptions below are **recorded**, not silent. Constitution v1.0.0 requires this for PRD §11 dependencies. **Q2 and Q12 are unconfirmed by Amend.** This slice proceeds on the recorded assumptions in `docs/decisions/assumptions-log.md`. If Amend answers differently, listing default and DOC display/search MUST be revisited before treating this spec as client-signed.

### PRD §11 dependencies

| Question | Relevance to this slice | Decision in this spec |
| --- | --- | --- |
| **Q2** DOC affiliation field definition | What is stored, encrypted, shown, and searchable as “DOC affiliation” | **Proceed** on **structured, admin-managed controlled list (not free text)** per `docs/decisions/assumptions-log.md` (updated 2026-08-13). Directory shows and searches the **current list label** only when the member has shown that field. **Unconfirmed by Amend.** The PRD still asks for client sign-off on this field. **Revisit** if Amend requires free text, facility vs agency vs ID, or a different shape — display, search, and encryption stay tied to that answer. |
| **Q12** Default directory visibility | Whether new members are listed until they opt out, or hidden until they opt in | **Proceed** on **opt-in (default not listed)** per `docs/decisions/assumptions-log.md` and PRD §5.6’s own compliance note. **Unconfirmed by Amend.** The PRD asks the **LEAD program lead** to confirm this default. **Revisit** before treating launch privacy as signed. An opt-out default would be a material privacy change, not a copy tweak. |
| **Q3** Network name list | Search-by-network and same-program split | **Proceed** on **Pathways and LEAD only**, same as prior slices. |
| **Field-level toggles deferral** (scope-reduction list, not a numbered Q) | PRD §11 says field-level toggles *can* move to a later phase | **Do not defer.** This specify command and PRD §5.6 acceptance criteria include show/hide for DOC affiliation, title, and email. Launch includes those toggles. |
| **Q7** Retention / funder commitments | Audit rows for privacy changes and profile views | **Proceed** on PRD defaults (7y security / 3y other) as **policy**. A retention-sweep job is **out of scope**. |
| **Q8** FERPA / HIPAA / state regime | Directory PII | **Proceed** on the PRD preliminary read (neither FERPA nor HIPAA directly). Still: no PII to analytics, no cross-program existence leaks, DOC hidden unless shown. |
| **Q13** Data residency | Where records live in production | **Not a hosting decision in this slice.** Local/dev uses the existing local database. |

### Other assumptions

- **Authorization reuse**: Same three layers as `004` / `005` / `006`. Moderators see both programs on the directory (PRD §3 View directory is allowed for Moderator). Members never see the other program.
- **Welcome / opt-in surface**: `003` already sends the approval welcome message and does **not** include directory opt-in. This slice presents the toggle clearly at `/app/profile/privacy` and as a first-run prompt when an Active member who has not yet chosen listing opens the directory or the member home — so opt-in is not only a buried settings page. Email copy changes in `003` are not required.
- **Field defaults**: Listing off; DOC affiliation, title, and email hidden until the member shows each one.
- **Staff appearance**: Super Admin, Admin, and Moderator with no program role do not appear. A person who is both staff and Pathways or LEAD appears only if they opt in, and only to viewers allowed to see that program (staff viewers see them as they see other listed members).
- **Profile-view audit sampling**: PRD §6 marks `directory_profile_viewed` as sampled. This slice writes **one audit row per successful view** in tests and at launch. If volume later requires sampling, that is an operations change; the event name and identifiers stay the same. Product analytics still records each successful view for KPIs.
- **Search vs browse**: Loading the directory with an empty query counts as a search toward the 30/minute cap (otherwise a scraper pages the full list).
- **Self-view**: A member always manages their own privacy at `/app/profile/privacy` and sees stored field values there and on profile-edit. They are not required to opt in to see their own settings. Their own row appears in `/app/directory` only when they have opted in. Their own directory profile uses the same field hide rules as any other viewer (public-listing preview).
- **No messaging**: “Connect” in the PRD user story means find and view, not in-app messages.
- **No staff override**: Staff cannot flip another member’s listing or field toggles in this slice. Staff also cannot see hidden fields on directory surfaces (uniform hide).
- **Query privacy**: Search strings are not stored in audit or analytics.
- **Copy limits** (PRD unspecified): search box at most 200 characters. Longer input is rejected without searching.
- **Analytics helper**: Reuse the existing tracker; if it no-ops when no analytics key is configured, tests still assert payload shape locally.
- English-only UI; local session/MFA conventions from `002-auth-rbac` still apply.
