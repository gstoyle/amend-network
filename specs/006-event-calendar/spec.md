# Feature Specification: Event Calendar

**Feature Branch**: `006-event-calendar`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Start slice 006-event-calendar (PRD §5.3). Cover: admin event create/edit/cancel, calendar view (month/list), RSVP (yes/no/maybe with capacity + waitlist), ICS download, 24h reminder emails, virtual link reveal only to Yes RSVPs within 1 hour of start. Reuse the visibility pattern and three-layer authorization from prior slices."

**Cites**: PRD v1.1 §2 (Event RSVP rate KPI; event viewed and event RSVP analytics), §3 (view events / RSVP to events / create-edit-delete events), §4 (authorization model, visibility set), §5.3 (event calendar), §6 System 1 (`event_created`, `event_edited`, `event_cancelled`, `event_rsvp`) and System 2 (product analytics; no PII), Appendix A.2 (Event, EventRSVP), Appendix B.2–B.3 (`/app/events`, `/admin/events`); Constitution v1.0.0 Principles I, II, III, IV, V; `002-auth-rbac` visibility contract and three-layer authorization; `004-resource-library` and `005-announcements` as prior content tables on that same visibility set.

## Scope

This slice delivers a **role-gated event calendar with RSVP**, plus the staff workflow to create, edit, and cancel events. Members see only events whose visibility intersects their roles. They can answer Yes / No / Maybe. Optional capacity turns extra Yes answers into a waitlist. Each event page offers a calendar file. Yes RSVPs receive a calendar invite when they confirm and a reminder 24 hours before start. A virtual join link is shown only to Yes RSVPs, and only from one hour before start until the event ends.

This is the **third product content table** on Constitution Principle I’s visibility set (`all_authenticated` | `pathways` | `lead`). It MUST reuse the same visibility contract and three-layer authorization already proven in `002-auth-rbac`, `004-resource-library`, and `005-announcements`. It MUST NOT introduce a second authorization model, a new visibility vocabulary, or a client-supplied role.

**In scope**

- Admin, Super Admin, and Moderator create, edit, and cancel events: title, description, start/end, timezone display, physical location and/or virtual meeting, optional capacity, visibility set, host
- Member calendar at `/app/events` with month and list views of events the signed-in member is allowed to see; upcoming visible events on the member home
- Event detail: title, description, times in the viewer’s local timezone, location (physical address when present), capacity, host, RSVP controls, calendar-file download
- RSVP Yes / No / Maybe; optional Yes cap; further Yes attempts go on a waitlist; one response per member per event
- Calendar file download from the event page; a calendar invite sent when the member RSVPs Yes (or is promoted from waitlist to Yes)
- Reminder to all current Yes RSVPs 24 hours before start
- Virtual join link revealed only to Yes RSVPs from one hour before start until the scheduled end
- Notify RSVPs when start/end change (optional staff message) and when the event is cancelled
- Soft cancel: members stop seeing it; the record and RSVPs remain for audit
- Audit events `event_created`, `event_edited`, `event_cancelled`, `event_rsvp`
- Product analytics: event viewed, event RSVP (yes / no / waitlist) with opaque user id and role labels only
- Permission-matrix proofs for **View events**, **RSVP to events**, and **Create / edit / delete events** in PRD §3, run both through the application and with the application bypassed

**Out of scope**

- Sign-in, sessions, MFA, `requireRole`, the audit writer, the visibility contract, the email sender, and the analytics tracker themselves (already prior slices; this slice **consumes** them)
- Registration, invitation, and approval (`003`)
- Resource library, announcement banners, directory, forum, WordPress feed
- Recurring event series, ticket sales, paid events, or external calendar sync beyond the downloadable file and invite
- A separate “join link is ready” email at the one-hour mark (members open the event page)
- Public or unauthenticated event pages
- Member-authored events
- Admin analytics dashboards and RSVP leaderboards (this slice writes the events those views will use later)
- A new authorization mechanism, a second visibility vocabulary, or client-supplied roles
- Production host provisioning

## User Scenarios & Testing *(mandatory)*

Primary actors: **Pathways member**, **LEAD member**, **Admin**, **Super Admin**, **Moderator**. **Pending members**, **invited token holders**, and **signed-out visitors** must be refused without leaking whether an event exists.

### User Story 1 - Staff publish a visibility-targeted event (Priority: P1)

An MFA-satisfied Admin, Super Admin, or Moderator opens the event workspace, writes a title and description, sets start and end, chooses visibility (everyone signed in, Pathways, LEAD, or a combination), and optionally sets a physical location, a virtual meeting, a capacity, and a host. Members in the intended audience can find it on the calendar; members outside that audience cannot.

**Why this priority**: Nothing else in this slice exists until authorized staff can publish a complete, visibility-tagged event (PRD §5.3).

**Independent Test**: As Admin (MFA-satisfied), create one shared event and one Pathways-only event. Confirm both appear in the admin list. Confirm a Pathways member sees both on the calendar; a LEAD member sees only the shared one; a Pathways member cannot open the admin create form.

**Acceptance Scenarios**:

1. **Given** an MFA-satisfied Admin, Super Admin, or Moderator, **When** they submit a complete event (title, description, start, end after start, at least one visibility value), **Then** one event exists, `event_created` is written, and members in the visibility set can see it.
2. **Given** a required field missing, end at or before start, or a virtual event with no join destination, **When** they submit, **Then** no event is created and the reason is shown to that staff member.
3. **Given** an event visible to both Pathways and LEAD, **When** members of either program open the calendar, **Then** they see that single event (not two copies).
4. **Given** a Pathways member, LEAD member, or pending user, **When** they request the admin create or edit screens, **Then** they are denied and no event management data is returned.
5. **Given** a Moderator, **When** they create or edit an event they did not originally create, **Then** the change is allowed and `event_created` or `event_edited` is written (PRD §3).

---

### User Story 2 - Members browse a month and list calendar of events they are allowed to see (Priority: P1)

A signed-in Pathways or LEAD member opens `/app/events` and toggles month vs list. They only see events whose visibility intersects their roles and that have not been cancelled. Times appear in their local timezone. Pending users and public pages show none. Member home also shows upcoming events they are allowed to see.

**Why this priority**: Finding the right events is the member-facing value of this slice (PRD §5.3).

**Independent Test**: Create a shared event, a Pathways-only event, and a LEAD-only event. Confirm Pathways sees shared + Pathways-only in both month and list; LEAD sees shared + LEAD-only; pending sees none.

**Acceptance Scenarios**:

1. **Given** a Pathways member and an uncancelled Pathways-only event, **When** they open `/app/events` in month or list view, **Then** that event is shown.
2. **Given** a LEAD member and a Pathways-only event, **When** they open the calendar, **Then** that event is not shown.
3. **Given** a cancelled event the member would otherwise see, **When** they open the calendar or detail, **Then** it is omitted without saying it was cancelled.
4. **Given** a pending member, invited token holder, or signed-out visitor, **When** they request member events, **Then** they receive none and existence is not leaked.
5. **Given** a member on `/app`, **When** upcoming visible events exist, **Then** those events appear on the home dashboard as well as on `/app/events`.

---

### User Story 3 - Members RSVP Yes / No / Maybe, with capacity and waitlist (Priority: P1)

On an event they can see, a member answers Yes, No, or Maybe. If the event has a capacity and Yes seats are full, a further Yes is placed on the waitlist and the member is told the event is full. They can change their answer later. One response is stored per member per event. Maybe and No do not consume capacity.

**Why this priority**: RSVP with a full/waitlist state is the interaction PRD §5.3 requires; Event RSVP rate is a launch KPI (PRD §2).

**Independent Test**: Event with capacity 1. First Pathways member RSVPs Yes (counted as Yes). Second Pathways member chooses Yes and is waitlisted. First member switches to No; second is promoted to Yes and notified.

**Acceptance Scenarios**:

1. **Given** a member who can see an event with remaining Yes capacity (or no cap), **When** they choose Yes, **Then** their status is Yes, `event_rsvp` is written, and analytics records a yes RSVP.
2. **Given** Yes count already equals capacity, **When** another visible member chooses Yes, **Then** their status is waitlist, they are told the event is full, and analytics records waitlist (not yes).
3. **Given** a waitlisted member and a Yes seat frees (Yes changes to No or Maybe, or that Yes is cancelled as a person), **When** the next waitlisted member is promoted, **Then** their status becomes Yes, they are notified, and `event_rsvp` is written for the promotion.
4. **Given** Maybe or No, **When** they save, **Then** they do not occupy a Yes seat and are not waitlisted.
5. **Given** a member who cannot see the event, **When** they attempt to RSVP, **Then** the attempt fails without revealing whether the event exists.
6. **Given** the same member RSVPs twice, **When** they change Yes → Maybe, **Then** one stored response reflects Maybe and a Yes seat is freed if they had held one.

---

### User Story 4 - Staff edit, notify RSVPs, and cancel (Priority: P2)

Staff change an event in place. If start or end changes and anyone has RSVPed, they are offered a notify-RSVPs step with an optional custom message. Cancel hides the event from members immediately, keeps the record and RSVPs for audit, writes `event_cancelled`, and notifies everyone who RSVPed.

**Why this priority**: Program staff need to correct times and stop a cancelled gathering (PRD §5.3 edge cases).

**Independent Test**: Create an event, collect two Yes RSVPs, change the start time with a notify message, then cancel. Confirm both members were notified of the time change and of cancellation; the calendar no longer lists the event.

**Acceptance Scenarios**:

1. **Given** MFA-satisfied Admin, Super Admin, or Moderator, **When** they edit title, description, visibility, location, capacity, or host, **Then** `event_edited` is written and members see the update on the next load.
2. **Given** RSVPs exist, **When** staff change start or end, **Then** they must confirm whether to notify RSVPs and may include a custom message; if they notify, every current RSVP (Yes, No, Maybe, waitlist) is emailed.
3. **Given** an uncancelled event, **When** they cancel it, **Then** members stop seeing it, RSVPs remain on the record, `event_cancelled` is written, and all RSVPs are notified.
4. **Given** a Pathways or LEAD member, **When** they request cancel or admin edit, **Then** they are denied.

---

### User Story 5 - Calendar file download and invite on Yes (Priority: P2)

From an event the member can see, they download a calendar file with title, times, and physical location. When they become Yes (direct RSVP or waitlist promotion), they also receive a calendar invite by email. The virtual join link is omitted from the file and the invite until the reveal rule in User Story 7 allows it.

**Why this priority**: PRD §5.3 requires a downloadable calendar file and an invite on RSVP.

**Independent Test**: Pathways member downloads the file for a visible event (times and address present, no virtual link). They RSVP Yes and receive an invite email that also omits the virtual link while more than one hour remains before start.

**Acceptance Scenarios**:

1. **Given** a member who can see an event, **When** they download the calendar file, **Then** they receive a file they can add to a personal calendar, with title, start, end, and physical location when present.
2. **Given** a member who cannot see the event, **When** they request the file, **Then** they are withheld the same as an unknown event.
3. **Given** a member becomes Yes, **When** that RSVP is saved, **Then** one calendar invite email is sent to that member.
4. **Given** a waitlisted member is promoted to Yes, **When** promotion happens, **Then** they receive the same Yes invite they would have received for a direct Yes.
5. **Given** more than one hour remains before start, **When** the file or invite is produced, **Then** it does not include the virtual join link.

---

### User Story 6 - Yes RSVPs are reminded 24 hours before start (Priority: P2)

Everyone whose status is Yes 24 hours before start receives one reminder email. Waitlist, Maybe, and No do not. If the event is cancelled before then, no reminder goes out.

**Why this priority**: PRD §5.3 requires a 24-hour reminder to Yes RSVPs.

**Independent Test**: Three members on one event (Yes, Maybe, waitlist). Advance to 24 hours before start. Confirm only the Yes member is reminded, once.

**Acceptance Scenarios**:

1. **Given** a Yes RSVP and an uncancelled event, **When** the 24-hour-before-start reminder runs, **Then** that member receives one reminder.
2. **Given** Maybe, No, or waitlist, **When** that reminder runs, **Then** they are not reminded.
3. **Given** the event was cancelled before the reminder, **When** the reminder would have run, **Then** no reminder is sent.
4. **Given** a member who became Yes after the reminder already ran, **When** they later view the event, **Then** they are not owed a late 24-hour reminder (they still get the Yes invite at RSVP time).

---

### User Story 7 - Virtual join link only for Yes, only near start (Priority: P2)

The virtual join destination is stored with the event but is not shown on the calendar, detail page, calendar file, or email until the member is Yes **and** now is at most one hour before start and not after the scheduled end. Maybe, No, waitlist, and non-RSVP members never see it. Other programs never see a hidden cohort’s link.

**Why this priority**: PRD §5.3 requires this reveal rule specifically to discourage leakage.

**Independent Test**: Virtual LEAD-only event. A LEAD Yes member more than one hour before start does not see the link; inside the last hour they do. A LEAD Maybe member inside the last hour does not. A Pathways member never sees the event or the link.

**Acceptance Scenarios**:

1. **Given** a Yes RSVP and now earlier than one hour before start, **When** they open detail, download the file, or read mail, **Then** the virtual join link is not included.
2. **Given** a Yes RSVP and now inside `[start − 1 hour, end]`, **When** they open detail, **Then** the virtual join link is shown.
3. **Given** Maybe, No, waitlist, or no RSVP, **When** they open detail inside that window, **Then** the virtual join link is not shown.
4. **Given** a member who cannot see the event, **When** they guess the id, **Then** they receive the same withholding as unknown — not a “link hidden” message.

---

### Edge Cases

- End at or before start: rejected; no record.
- Capacity empty: unlimited Yes; waitlist is not used.
- Capacity 1 with two Yes attempts: first Yes, second waitlist.
- Waitlist promotion order: oldest waitlist first (time they joined the waitlist).
- Yes → Maybe/No while waitlist exists: one Yes seat frees; oldest waitlist becomes Yes and is notified.
- Capacity reduced below current Yes count on edit: existing Yes members are not automatically demoted in this slice; staff are warned; new Yes answers waitlist until Yes count is under the new cap.
- Cancelled event: omitted from member calendar and detail; admin list still shows it as cancelled; RSVPs retained.
- Guessed event id outside visibility or cancelled: same withholding as unknown; no cohort or existence leak.
- Client-supplied role header, query parameter, or body field: ignored.
- Description attempting raw markup: only bold, links, and inline emphasis are kept.
- Administrative user with program role `none` on member pages: sees `all_authenticated` events only; on admin pages, Admin/Super Admin/Moderator manage every visibility.
- Moderator sees every visibility on member calendar (tokens include both programs) and may create/edit/cancel.
- Pending, denied, deactivated, invited, and signed-out: 0 events and 0 RSVPs.
- Timezone: stored as a single absolute start/end; shown in the viewer’s local timezone; staff editor shows that absolute time and a timezone hint so they are not surprised by UTC vs local.
- Clock at exactly one hour before start: treat as inside the reveal window (inclusive). Clock at scheduled end: still inside the reveal window (inclusive). After end: link no longer shown.
- Reminder job running twice: still one reminder email per Yes member per event.
- Analytics events carry opaque user ids and role labels only — never names, emails, titles, descriptions, or join URLs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Super Admin, Admin, and Moderator MUST be able to create an event with required title, description, start, end (after start), and visibility set, plus optional physical location, virtual join destination, capacity, timezone hint, and host. Cites PRD §5.3, Appendix A.2.
- **FR-002**: Description MUST allow only bold, links, and inline emphasis. Raw markup from the author MUST NEVER be written through as active HTML. Cites Constitution Principle II.
- **FR-003**: End MUST be after start. A virtual event MUST include a join destination at save time (the destination is stored, not shown, until FR-020).
- **FR-004**: Visibility MUST be a set of one or more of `all_authenticated`, `pathways`, and `lead`. A user sees the event if and only if any of their roles intersects that set **and** the event is not cancelled. Events visible to multiple audiences MUST be stored once. Cites PRD §4, Constitution Principle I. This MUST be the same vocabulary and intersection rule as `004-resource-library` / `005-announcements`.
- **FR-005**: This slice MUST reuse the `002-auth-rbac` authorization mechanism. It MUST NOT invent a parallel permission model, a new visibility vocabulary, or trust a role claim from the client.
- **FR-006 (layer 1)**: Member event surfaces (`/app/events`, `/app/events/[id]`, calendar file, RSVP) MUST require a session. Admin event routes (`/admin/events`, `/admin/events/new`, `/admin/events/[id]`) MUST require a session and MFA-satisfied. Unauthenticated requests MUST NOT return event data.
- **FR-007 (layer 2)**: Every server path that returns or mutates event or RSVP data MUST call `requireRole` (or the equivalent named helper from `002-auth-rbac`) **before** returning data. Role MUST come from the signed session. The helper MUST NOT be mocked in tests whose purpose is to verify the role check.
- **FR-008 (layer 3)**: The event table MUST carry the same visibility set as Constitution Principle I, with queries including role-based filters **and** native database row-level security enabled. That policy layer MUST NOT depend on a managed-database vendor. Cancelled rows MUST be withheld from members at this layer as well. RSVP rows MUST be readable/writable only for the signed-in user (plus staff as needed for support), never for another member via the client.
- **FR-009**: Create, edit, and cancel MUST be allowed for Super Admin, Admin, and Moderator, including Moderators editing events they did not create. Pathways, LEAD, pending, and invited MUST be denied those mutations. Cites PRD §3.
- **FR-010**: View events MUST be allowed for Super Admin, Admin, and Moderator (all visibilities), role-targeted for Pathways and LEAD, and denied for pending and invited. Cites PRD §3.
- **FR-011**: RSVP MUST be allowed only for a member who can view that event. Pending and invited MUST be denied. Cites PRD §3.
- **FR-012**: Members MUST have month and list views of visible, uncancelled events at `/app/events`, and upcoming visible events on member home. Times MUST render in the viewer’s local timezone. Cites PRD §5.3, Appendix B.2.
- **FR-013**: Event detail MUST show title, description, start/end in local timezone, physical location when present, capacity when set, host, and RSVP controls. The virtual join link MUST follow FR-020. Cites PRD §5.3.
- **FR-014**: RSVP MUST support Yes, No, and Maybe, exactly one stored response per user per event. Cites PRD §5.3, Appendix A.2.
- **FR-015**: When capacity is set, Yes count MUST NOT exceed capacity. Further Yes attempts MUST become waitlist and MUST tell the member the event is full. Maybe and No MUST NOT consume capacity. Cites PRD §5.3. This slice **includes waitlist** (PRD §5.3); it does **not** take the PRD §11 optional deferral of waitlisting.
- **FR-016**: When a Yes seat frees and waitlist entries exist, the oldest waitlisted member MUST be promoted to Yes and notified (same Yes invite as a direct Yes).
- **FR-017**: Cancel MUST hide the event from all member views immediately while retaining the event and RSVP rows for audit. Member-facing withholding MUST NOT announce that it was cancelled. The action MUST write `event_cancelled` and notify all current RSVPs. Cites PRD §5.3.
- **FR-018**: Edit of start or end when any RSVP exists MUST offer notify-RSVPs with an optional custom message. Cites PRD §5.3.
- **FR-019**: A calendar file MUST be downloadable from an event the member can see. Becoming Yes MUST send a calendar invite email. Virtual join destinations MUST be omitted from file and mail until FR-020 allows reveal. Cites PRD §5.3.
- **FR-020**: The virtual join destination MUST be revealed only to Yes RSVPs, and only when now is in `[start − 1 hour, end]`. All other statuses and times MUST omit it. Cites PRD §5.3.
- **FR-021**: One reminder email MUST be sent to each member whose status is Yes at 24 hours before start, for uncancelled events. Waitlist, Maybe, and No MUST NOT receive it. Cites PRD §5.3.
- **FR-022**: This slice MUST emit `event_created`, `event_edited`, `event_cancelled`, and `event_rsvp` through the existing append-only audit writer. Rows remain append-only. Cites PRD §6.
- **FR-023**: When a member opens an event they can see, the product MUST record `event viewed`. When they RSVP, the product MUST record `event RSVP` with status `yes`, `no`, or `waitlist` (Maybe is stored on the RSVP but is not a named analytics status in PRD §6 — record it as a non-PII status label `maybe` so the KPI is not missing Maybe). Cites PRD §2, §6.
- **FR-024**: Product analytics for this slice MUST receive opaque user ids and role labels only. Names, emails, DOC affiliation, titles, descriptions, locations, and virtual join destinations MUST NEVER appear. Cites Constitution Principle II, PRD §2 / §6.
- **FR-025**: CSRF protection MUST apply to every state-changing event request (create, edit, cancel, RSVP). Cites PRD §8.
- **FR-026**: Every row of the PRD §3 permission matrix for **View events**, **RSVP to events**, and **Create / edit / delete events** MUST be asserted. The matrix MUST run twice: through the application, and directly against the database with the application bypassed. Other capabilities remain fail-closed if not implemented here. Cites Constitution Principle IV.
- **FR-027**: Every route handler delivered in this slice MUST have a test that it rejects an unauthorized role, not only that it accepts an authorized one.
- **FR-028**: Secrets MUST NEVER appear in Git, recoverable test fixtures, or log lines. Hostnames and connection strings MUST come from environment variables only. Cites Constitution Principle III.
- **FR-029**: Calendar, detail, and RSVP controls MUST meet WCAG 2.1 AA for this surface: targets at least 44×44 CSS pixels, a name for every control, month/list toggle operable by keyboard, and no motion that ignores reduced-motion. Cites Constitution Principle V.
- **FR-030**: Reminder and invite email MUST use the existing transactional mail path. Copy MUST NOT include virtual join destinations except when FR-020 would already reveal them to that recipient.

### Key Entities

- **Event**: A staff-authored gathering (title, description, start, end, timezone hint, physical location, whether virtual, virtual join destination, optional capacity, visibility set, host, created/updated time, optional cancel time). Identity is stable across edits.
- **Visibility set**: `all_authenticated` | `pathways` | `lead` (one or more). Same contract as prior content slices.
- **Event RSVP**: One response per user per event: Yes, No, Maybe, or waitlist, and when it was last set.
- **Audit log**: Existing append-only store; this slice uses the four event content actions already enumerated in PRD §6.
- **Analytics events**: Existing opaque tracker; this slice adds event viewed and event RSVP.

### Constraints (mandated by PRD §5.3 / §3 / §4 / §6 and Constitution; not open design)

This slice does not re-open authentication, authorization, or hosting choices. Plan and tasks MUST reuse `002-auth-rbac` sessions, `requireRole` from the signed session, native database row-level security on the event table (and RSVP records), the append-only audit writer, and the existing transactional email helper. Event viewed / RSVP recording MUST go through the existing analytics helper (opaque ids and role labels only; extra/PII fields rejected). Do not introduce a new authorization library, a managed-database proprietary policy layer, client-supplied roles, or a second visibility vocabulary. The 24-hour reminder is a scheduled pass (constitution: background jobs are system cron on the host; locally, the same pass MUST be invocable without a production host). Calendar files MUST be produced by the application after a role check — never an unauthenticated public file URL.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An MFA-satisfied Admin can create a complete event (title, description, start/end, visibility, optional location/capacity) in under 3 minutes.
- **SC-002**: 100% of unauthorized attempts in the three PRD §3 event capabilities are denied on both the application run and the application-bypassed database run. Zero cross-role event leaks in those runs.
- **SC-003**: A Pathways member is shown 0 LEAD-only events; a LEAD member is shown 0 Pathways-only events; both are shown shared (`all_authenticated`) events that are not cancelled.
- **SC-004**: Pending members, invited token holders, and signed-out visitors receive 0 event records and 0 RSVPs from member surfaces.
- **SC-005**: Month and list views on `/app/events` show the same visible uncancelled set; a member can switch between them in one control action.
- **SC-006**: For an event with capacity N, the Nth Yes succeeds as Yes and the (N+1)th Yes is waitlisted; when one Yes frees, the oldest waitlist becomes Yes.
- **SC-007**: After cancel, 100% of member calendar and detail views omit that event; the admin list still shows it as cancelled; RSVP rows remain.
- **SC-008**: 100% of calendar files and Yes-invite emails produced more than one hour before start contain 0 virtual join destinations; 100% of Yes members opening detail inside `[start − 1 hour, end]` see the link; 100% of Maybe / No / waitlist / other-program viewers do not.
- **SC-009**: 100% of Yes members at 24 hours before an uncancelled start receive exactly one reminder; 100% of Maybe / No / waitlist members receive 0 reminders for that run.
- **SC-010**: 100% of event viewed and event RSVP payloads in the test set contain 0 names, emails, DOC affiliations, titles, descriptions, locations, or join URLs.
- **SC-011**: Moderators succeed at create/edit/cancel; Pathways and LEAD succeed at 0 of those mutations.
- **SC-012**: A developer following local steps can create, show by role, RSVP with waitlist promotion, download a calendar file, run the reminder pass, reveal a virtual link inside the one-hour window, edit time with notify, and cancel — against a local database with no production host.

## Assumptions

Named assumptions below are **recorded**, not silent. Constitution v1.0.0 requires this for PRD §11 dependencies.

### PRD §11 dependencies

| Question | Relevance to this slice | Decision in this spec |
| --- | --- | --- |
| **Q3** Network name list | Visibility tokens and who sees role-specific events | **Proceed** on **Pathways and LEAD only**, same as prior slices. Visibility remains `all_authenticated \| pathways \| lead`. **Revisit** if Amend adds networks. |
| **Q6** Email provider | Invites, reminders, cancel/time-change notices | **Proceed** on the constitution/PRD mailer (Postmark in production; existing local transport in tests). This slice does not choose a new vendor. **Revisit** if Amend mandates a different provider before launch. |
| **Q7** Retention / funder commitments | Cancelled events and RSVP rows vs audit period | **Proceed** on PRD defaults (7y security / 3y other) as **policy**. A retention-sweep job is **out of scope**; cancel MUST NOT erase the event row, RSVPs, or audit history. |
| **Q8** FERPA / HIPAA / state regime | Event copy and attendance | **Proceed** on the PRD preliminary read (neither FERPA nor HIPAA directly). Still: no PII to analytics, no existence leaks across roles, no virtual-link leakage. |
| **Q13** Data residency | Where records live in production | **Not a hosting decision in this slice.** Local/dev uses the existing local database. |
| **Waitlisting deferral** (scope-reduction list, not a numbered Q) | PRD §11 says waitlisting *can* be deferred to “event full” only | **Do not defer.** This specify command and PRD §5.3 acceptance criteria include waitlist. Launch includes waitlist + promotion. |

### Other assumptions

- **Authorization reuse**: Same visibility intersection and three layers as `004` / `005`. Moderators see both program visibilities on member pages and **may** create/edit/cancel (unlike announcements).
- **Inclusive reveal window**: Virtual link is eligible at exactly one hour before start and at exactly the scheduled end (closed interval). After end, it is hidden.
- **Waitlist order**: Oldest waitlist timestamp first. Promotion is automatic when a Yes seat frees.
- **Capacity shrink**: Do not silently demote existing Yes members; warn staff; new Yes answers waitlist.
- **One RSVP row**: Status is updated in place; history of prior statuses is not a member-facing feature (audit `event_rsvp` rows remain append-only).
- **Maybe analytics**: PRD §6 names yes/no/waitlist; Maybe is stored and emitted as a non-PII `maybe` label so the product is not silent on that status.
- **No 1-hour “link ready” email**: Reveal is on the event page (and in file/mail only once the window is open).
- **Calendar file contents**: Title, start, end, physical location; virtual URL only when FR-020 would show it to that member.
- **Copy limits** (PRD unspecified): title at most 120 characters; description at most 5,000 characters; location at most 200 characters. Enough for a workshop write-up, still usable at 360px.
- **Host**: Optional; when set, shown as a name the member is allowed to see (directory privacy for hosts is out of scope — show the host display name already used in admin session, not extra PII fields).
- **Timezone hint**: Staff enter start/end as a concrete instant; the hint is a label (e.g. program timezone) so editors are not confused; members always see local time.
- **Reminder idempotence**: At most one 24-hour reminder per user per event, even if the scheduled pass runs twice.
- **Analytics helper**: Reuse the existing tracker; if it no-ops when no analytics key is configured, tests still assert payload shape locally.
- English-only UI; local session/MFA conventions from `002-auth-rbac` still apply.
