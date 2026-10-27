# Feature Specification: Programme Cohorts

**Feature Branch**: `014-program-cohorts`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "We will need to be able to add different cohorts to the site under LEAD and Immersion, and keep them separate. For example, under Global Learning Experiences we might have 'Norway Sept 26' and then 'Norway April 27', or 'UK Spring 27' etc." Recommendation accepted 2026-10-27: cohorts layer on top of programmes; content can target a programme or specific cohorts; cohort forum rooms are opt-in per cohort; directory stays programme-wide with a cohort label and filter; past cohorts keep access.

**Cites**: PRD v1.1 §1 (architecture designed so new groupings can be added post-launch), §2 (strengthen cross-cohort connection without compromising role separation), §3 (one primary program role; cohort identity), §4 Authorization model, §5.2 (Network Name dropdown determines program role), §5.3–5.7 (visibility on events, announcements, resources, directory, forum), §6 System 1 (audit) and System 2 (no PII in analytics), §10 Phase 3 ("Cohort / working-group sub-spaces within a program role"), §11 Q3 (network list); Constitution Principles I, II, IV, V.

## Scope

A **cohort** is a named group inside one programme — for example *Norway Sept 26* or *UK Spring 27* under Global Learning Experiences, or a LEAD intake. Every member belongs to their programme through at least one cohort. Cohorts add a narrower audience without replacing the programme audience.

This slice delivers cohort management for staff, cohort-targeted visibility on every content type, opt-in cohort forum rooms, and a cohort label and filter in the directory. It reuses the existing three-layer authorization; a cohort is one more value a member's access can intersect.

**In scope**

- Admin and Super Admin create, rename, and archive cohorts under a programme
- Admin and Super Admin add a member to an additional cohort, or remove a non-primary cohort
- Registration and invitations offer only active (non-archived) cohorts
- Resources, events, announcements, and forum rooms can target one or more specific cohorts, alongside the existing *Everyone signed in* and programme options
- The audience marker beside content names the cohort(s) when an item is cohort-only
- Directory listings show each member's cohort(s); members can filter the directory by cohort
- Audit rows for cohort create, rename, archive, membership add, and membership remove
- Permission proofs through the application and directly against Postgres for cohort-only content

**Out of scope**

- Cohort-scoped directory (members still see their whole programme)
- Automatic forum room per cohort
- Moving a member's primary cohort to a different programme (existing approval flow governs program role)
- Cohort-specific moderators or cohort leads as a new role
- Bulk import of cohort memberships beyond the existing invite CSV `network_name` column
- Deleting a cohort that has members or content (archive instead)
- Per-cohort analytics dashboards (existing programme split stays)

## Clarifications

### Session 2026-10-27

- Q: Should a member's cohort replace their programme access, or sit on top of it? → A: On top. Cohort membership grants the programme audience plus that cohort's audience.
- Q: Do past cohorts lose access when a trip ends? → A: No. Archiving only removes the cohort from registration and invite choices.
- Q: Directory scope? → A: Programme-wide, with cohort shown on each listing and a cohort filter.
- Q: Forum? → A: Cohort rooms only where an Admin creates one; programme rooms remain.

## User Scenarios & Testing *(mandatory)*

Primary actors: **Global Learning Experiences member**, **LEAD member**, **member of more than one cohort**, **Moderator**, **Admin**, **Super Admin**. Pending members and signed-out visitors are refused without learning whether a cohort or cohort item exists.

### User Story 1 - Staff manage cohorts and memberships (Priority: P1)

An Admin opens Admin → Cohorts, sees cohorts grouped by programme, adds *Norway April 27* under Global Learning Experiences, renames a typo, and later archives *Norway Sept 26* once the trip and its follow-up are over. From a member's admin record, the Admin adds that member to a second cohort (a repeat traveller) or removes a non-primary cohort added in error.

**Why this priority**: Nothing else in this slice works until cohorts and memberships can be maintained without a developer. It is useful on its own: new trips can open for registration the day they are announced.

**Independent Test**: As Admin, create a cohort, confirm it appears in the registration and invite network choices; archive it, confirm it disappears from those choices while existing members keep their access; add and remove an extra membership and confirm audit rows.

**Acceptance Scenarios**:

1. **Given** an Admin, **When** they create a cohort with a name and programme, **Then** it is listed under that programme and offered on Request access and Invite.
2. **Given** a cohort name already in use, **When** an Admin creates or renames another cohort to that name, **Then** the change is refused with a plain message.
3. **Given** an archived cohort, **When** a prospective member opens Request access, **Then** it is not offered, and existing members of that cohort keep their programme and cohort access.
4. **Given** a member whose primary cohort is *Norway Sept 26*, **When** an Admin adds *Norway April 27*, **Then** the member gains that cohort's audience on their next page load and an audit row is written.
5. **Given** a member's primary cohort, **When** an Admin tries to remove it, **Then** removal is refused; only additional cohorts can be removed.
6. **Given** a Moderator or a program member, **When** they request cohort management or membership changes, **Then** they are refused.

---

### User Story 2 - Publish to specific cohorts (Priority: P1)

An Admin publishing a packing list chooses *Norway April 27 only*. A Moderator creating an event chooses the same cohort. Members of that cohort see the item; members of *Norway Sept 26* and *UK Spring 27* do not, even though all three are Global Learning Experiences. Programme-wide items still reach every cohort in the programme.

**Why this priority**: This is the separation the client asked for. Without it, cohorts are labels only.

**Independent Test**: Publish one item to *Norway April 27* only and one to Global Learning Experiences. Sign in as a member of each of two cohorts and a LEAD member; confirm only the right member sees the cohort item, both GLE members see the programme item, and the LEAD member sees neither. Repeat the visibility check directly against the database with the application bypassed.

**Acceptance Scenarios**:

1. **Given** a resource visible to *Norway April 27* only, **When** a *Norway Sept 26* member lists, searches, opens, or downloads it, **Then** it is absent or refused without confirming it exists.
2. **Given** that resource, **When** a *Norway April 27* member opens it, **Then** they can view and download it, and the audience marker reads *Norway April 27 only*.
3. **Given** an item visible to two cohorts, **When** a member of either cohort opens it, **Then** they can see it.
4. **Given** an item visible to Global Learning Experiences, **When** any member of any Global Learning Experiences cohort opens it, **Then** they can see it.
5. **Given** a member of both *Norway Sept 26* and *Norway April 27*, **When** they browse, **Then** they see items for either cohort.
6. **Given** a Moderator, Admin, or Super Admin, **When** they browse member or admin pages, **Then** they can see cohort-only items for every cohort.
7. **Given** a staff publisher, **When** they submit a visibility that names an unknown or archived cohort, **Then** publication is refused; archived cohorts are not offered as new targets.
8. **Given** an item already targeted at a cohort that is later archived, **When** that cohort's members return, **Then** they still see the item.

---

### User Story 3 - Cohort forum rooms (Priority: P2)

An Admin creates a forum room *Norway April 27* visible to that cohort only. Members of that cohort who have joined the directory can read and post; other Global Learning Experiences members do not see the room. Programme rooms continue as before.

**Why this priority**: Trip groups need a place to talk before and after travel, but moderation capacity is limited, so rooms exist only where staff choose to run one.

**Independent Test**: Create a cohort room; confirm a listed member of the cohort can post, a listed member of another cohort in the same programme cannot see it, an unlisted member of the cohort hits the existing directory gate, and staff can moderate it.

**Acceptance Scenarios**:

1. **Given** a cohort room, **When** a listed member of that cohort opens Forum, **Then** the room appears and they can start threads and reply.
2. **Given** that room, **When** a listed member of another cohort in the same programme opens Forum or a direct room or thread link, **Then** the room is absent or refused without leaking existence.
3. **Given** an unlisted member of the cohort, **When** they open Forum, **Then** the existing join-the-directory prompt appears.
4. **Given** a forum room form, **When** an Admin chooses visibility, **Then** *Everyone signed in* is still unavailable (all-members room remains paused) and programme and cohort options are available.

---

### User Story 4 - See and filter cohorts in the directory (Priority: P3)

A member browsing the directory sees each listed person's cohort(s) beside their programme and can filter to *Norway April 27* to find their travel group. They still see every listed member of their programme.

**Why this priority**: Helpful for finding a travel group, but separation does not depend on it.

**Independent Test**: List members in two cohorts of the same programme; confirm both appear unfiltered with correct cohort labels, the cohort filter narrows the list, and a LEAD cohort is not offered to a Global Learning Experiences-only viewer.

**Acceptance Scenarios**:

1. **Given** listed members in *Norway Sept 26* and *Norway April 27*, **When** a Global Learning Experiences member opens Directory, **Then** both appear with their cohort names.
2. **Given** the cohort filter set to *Norway April 27*, **When** results load, **Then** only listed members of that cohort appear.
3. **Given** a viewer outside a programme, **When** they open the cohort filter, **Then** that programme's cohorts are not offered.
4. **Given** a member hides optional fields, **When** others view the directory, **Then** cohort is shown like network today, and hidden fields stay hidden.

### Edge Cases

- A member belongs to cohorts in both programmes: they see both programmes' shared items plus each of their cohorts' items.
- A member is removed from an additional cohort while signed in: cohort-only items disappear on the next request; nothing they already downloaded is recalled.
- A cohort is renamed: content, memberships, and forum rooms keep working; audience markers and directory labels show the new name.
- A cohort is archived with an open forum room: the room stays available to its members; staff may lock or pause it as they do today.
- An item names a cohort and its programme: programme visibility already covers it; the audience marker shows the programme.
- A staff-only account (no programme): cannot be added to a cohort; staff visibility comes from the administrative role.
- A pending member in a cohort sees nothing, as today.
- An analytics event involving cohort content carries opaque ids only, never cohort names typed by staff.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let Admin and Super Admin create a cohort with a unique name and exactly one programme (Global Learning Experiences or LEAD). Cites PRD §5.2, §11 Q3.
- **FR-002**: The system MUST let Admin and Super Admin rename a cohort and archive or unarchive it. Archiving MUST NOT remove memberships or change what members can see.
- **FR-003**: Registration and invitation network choices MUST list only active cohorts, grouped or labelled by programme. Invite CSV `network_name` MUST reject archived cohorts.
- **FR-004**: The system MUST let Admin and Super Admin add a member to any active cohort of a programme and remove any cohort other than the member's primary cohort. Staff-only accounts with no programme MUST NOT be added.
- **FR-005**: Cohort membership MUST grant the member the cohort's programme audience and that cohort's audience. Removing the last cohort in a programme MUST remove that programme's audience unless it is the member's primary programme.
- **FR-006**: Resources, events, announcements, and forum rooms MUST accept visibility that combines *Everyone signed in*, programmes, and specific cohorts, with the existing rule that forum rooms cannot use *Everyone signed in*. Cites PRD §5.3–5.5, §5.7.
- **FR-007**: A member MUST see an item if and only if their audiences intersect its visibility. This MUST hold in page and handler checks, in query filters, and in database row-level policies with the application bypassed. Cites PRD §4; Constitution I.
- **FR-008**: Moderator, Admin, and Super Admin MUST see cohort-only items for every cohort wherever they already see programme-only items.
- **FR-009**: Publishing or editing with an unknown cohort, or newly targeting an archived cohort, MUST be refused. Existing items targeting a since-archived cohort MUST remain visible to its members.
- **FR-010**: Audience markers MUST name cohorts for cohort-only items (for example *Norway April 27 only*, or *Norway Sept 26 and Norway April 27*).
- **FR-011**: Directory listings MUST show each listed member's cohort names within programmes the viewer may see, and the directory MUST offer a cohort filter limited to those cohorts. Cites PRD §5.6.
- **FR-012**: Cohort create, rename, archive, unarchive, membership add, and membership remove MUST each write an append-only audit row in the same transaction as the change. Cites PRD §6 System 1; Constitution II.
- **FR-013**: Analytics events MUST NOT include cohort names. Opaque ids and role labels only. Cites PRD §6 System 2.
- **FR-014**: Refusals MUST NOT reveal whether a cohort, cohort item, or cohort room exists.
- **FR-015**: The in-app Guide MUST explain cohorts to members and cohort management and targeting to staff.
- **FR-016**: Existing data MUST keep working without manual edits: the current *Norway & Northern Ireland | Fall 2026* group and LEAD become cohorts, and all existing programme-visible items keep their audience.

### Key Entities *(include if feature involves data)*

- **Cohort**: A named group inside one programme. Has a name, programme, and active or archived state. Today's "network" becomes a cohort; the stored programme role stays as is.
- **Cohort membership**: Links a member to a cohort. One membership is the member's primary cohort (set at registration or invite); others are added by staff.
- **Visibility entry**: An item's audience list, now able to include specific cohorts alongside *Everyone signed in* and programmes.
- **Audit event**: Existing append-only record, extended with cohort and membership actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Admin can create a new cohort and see it offered on Request access in under 2 minutes, without developer help.
- **SC-002**: In the permission proof, 100% of cohort-only fixtures are visible to their cohort and staff and invisible to every other cohort and programme, through the application and directly against the database.
- **SC-003**: After archiving a cohort, 100% of its members retain access to items they could see before archiving.
- **SC-004**: A member can find the members of their own cohort in the directory in 3 actions or fewer from Home.
- **SC-005**: No existing item changes audience as a result of the migration (before/after visibility comparison for every fixture role shows zero differences).

## Assumptions

- "Network" in the current product and PRD §5.2 is the same thing as a cohort; this slice renames it in staff-facing copy and adds lifecycle, not a second concept.
- Cohort items are hidden from other cohorts of the same trip (for example *Norway April 27* does not see *Norway Sept 26* cohort-only items) unless staff target both or the programme. **Default chosen 2026-10-27; to confirm with Amend.**
- Cohort names are operational labels, not personal data, but stay out of analytics anyway.
- Admin and Super Admin manage cohorts, matching DOC affiliation management. Moderators may target cohorts when creating events because they can already create events.
- The primary cohort remains the one used for registration, approval, and directory listing; additional cohorts add audience only.
- This slice extends the visibility vocabulary beyond `all_authenticated | pathways | lead`. That requires a written constitution amendment (Principle I) before implementation, recorded in the plan.
