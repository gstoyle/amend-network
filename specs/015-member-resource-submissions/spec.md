# Feature Specification: Member Resource Submissions

**Feature Branch**: `015-member-resource-submissions`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Regarding uploading resources, we need a way for the members to be able to do so. Ideally, we would have the ability to approve a resources addition before it is made live, but we don't want them to have to ask us to do it for them. (If we absolutely have to publish for them, can we have an option to attribute the link to them individually?)" Recommendation accepted 2026-10-27: members submit files or links; Admins review before anything goes live; approved items appear under *Shared by members* with the member's name; a pre-submission checklist; tighter file limits than staff; edits after approval go back through review.

**Cites**: PRD v1.1 §3 (permission matrix: *Upload / edit / delete resources* is Super Admin and Admin only), §5.5 (gated resource library, allowed file types, atomic creation), §5.7 compliance note (user-generated content in a correctional-system context needs clear guidelines and an escalation path), §6 System 1 (audit) and System 2 (no PII in analytics), §8 (malware scan at ingest, CSRF, private storage); Constitution Principles I, II, III, IV, V; `004-resource-library` (ingest, scan, signed access); `013-community-forum` (author label, directory-listing gate); `014-program-cohorts` (cohort audiences).

## Scope

Members can propose a resource — a file or a web link — without asking staff to upload it for them. Nothing a member submits is visible to other members until an Admin approves it. Approval is the publish step, so the PRD §3 rule that only Admin and Super Admin publish, edit, and delete library items still holds; this slice adds a separate, narrower **submit** capability for active members.

**In scope**

- A *Share a resource* form for active members: file or link, title, short description, topic tags, audience chosen from the member's own groups, and an optional thumbnail
- A required pre-submission checklist about privacy, ownership, and community guidelines
- A *My submissions* page showing each submission's status and any reviewer note
- An Admin review queue: approve (with optional edits to metadata, folder, and audience), return for changes with a note, or decline with a reason
- Published member items appear in *Shared by members* with an attribution line (*Shared by Jane D.*)
- Staff can publish on a member's behalf and attribute the item to that member
- Link resources (title, description, URL) for staff and members alike
- Member edits to an approved item go back through review while the approved version stays live
- Members can withdraw a pending submission or remove their own published item
- Members can report a published member item; reports join the review queue
- Email notifications: staff on new submissions and reports; the member on each decision
- Audit rows for every submission, decision, withdrawal, removal, and report

**Out of scope**

- Moderators reviewing submissions (Admin and Super Admin only at launch)
- Anonymous submissions
- Video submissions from members
- Comments or ratings on resources
- Automatic content screening beyond the existing malware scan
- Member-created folders

## Clarifications

### Session 2026-10-27

- Q: Should staff approve before an item goes live? → A: Yes. Every member submission, and every member edit to a published item, waits for Admin approval.
- Q: Do members have to ask staff to upload for them? → A: No. Members submit directly; staff only review.
- Q: If staff publish for a member, can the item be attributed to them? → A: Yes. Staff can pick the member as contributor, and the same *Shared by* line appears.
- Q: Can members share without their name? → A: No. Member items always show first name and last initial, like forum posts.

## User Scenarios & Testing *(mandatory)*

Primary actors: **Global Learning Experiences member**, **LEAD member**, **Admin**, **Super Admin**. Moderators, pending members, and signed-out visitors cannot submit or review, and are refused without learning whether a submission exists.

### User Story 1 - Member submits a resource (Priority: P1)

A Global Learning Experiences member who found a useful reentry housing guide opens Resources → *Share a resource*, uploads the PDF, adds a title and two-sentence description, tags it *Housing*, chooses *Norway April 27* as the audience, ticks the checklist, and submits. They see it on *My submissions* as *Waiting for review*. No other member can see it.

**Why this priority**: This is the capability the client asked for. Without it, every member contribution still goes through staff by email.

**Independent Test**: As a member, submit a file and a link. Confirm both appear on *My submissions* as waiting, neither appears in any other member's library, search, or direct link, and both appear in the Admin queue. Repeat the visibility check directly against the database with the application bypassed.

**Acceptance Scenarios**:

1. **Given** an active member, **When** they submit a permitted file with title, description, audience, and the checklist ticked, **Then** the submission is saved as waiting for review and an audit row is written.
2. **Given** an active member, **When** they submit an `http` or `https` link, **Then** it is saved the same way; other link schemes are refused.
3. **Given** a file of a type or size not allowed for members, **When** they submit, **Then** it is refused with a plain message before anything is stored.
4. **Given** a file that fails or cannot complete the malware scan, **When** they submit, **Then** the submission is refused, nothing is kept, and the member is told it could not be accepted without scanner detail.
5. **Given** the checklist is not fully ticked, **When** they submit, **Then** it is refused.
6. **Given** the audience picker, **When** a member opens it, **Then** it offers only programmes and cohorts they belong to.
7. **Given** a pending submission, **When** any other member lists, searches, or opens its direct link, **Then** it is absent or refused without confirming it exists.
8. **Given** a member who has reached the daily submission limit, **When** they submit again, **Then** they are asked to try later.
9. **Given** a Moderator, pending member, or staff-only account, **When** they open the form or post to it, **Then** they are refused.

---

### User Story 2 - Admin reviews submissions (Priority: P1)

An Admin opens Admin → Resources → *Submissions (3)*. They open the housing guide, preview the file, change the folder to *Housing*, widen the audience to all of Global Learning Experiences, and approve. It appears in *Shared by members* with *Shared by Jane D.* The member gets an email saying it is live. A second submission names a person in custody; the Admin declines it with the reason *Privacy*.

**Why this priority**: Approval is the safeguard that makes member submissions acceptable. Without it, Story 1 cannot ship.

**Independent Test**: Submit three items as a member. As Admin, approve one with edits, return one for changes, and decline one. Confirm only the approved item is visible to its audience, with the attribution line; the member sees each status and note; three audit rows and three member emails are produced.

**Acceptance Scenarios**:

1. **Given** pending submissions, **When** an Admin opens the queue, **Then** they see each item's title, type, submitter, audience, and age, oldest first.
2. **Given** a submission, **When** the Admin previews it, **Then** files open through the same short-lived, role-checked access as published resources, and links are shown as text before they are followed.
3. **Given** a submission, **When** the Admin approves it, **Then** it becomes visible to its audience in *Shared by members*, the source is *Members*, the contributor is the submitter, and an audit row is written in the same transaction.
4. **Given** a submission, **When** the Admin edits title, description, tags, folder, thumbnail, or audience before approving, **Then** the published item uses the edited values.
5. **Given** a submission, **When** the Admin returns it with a note, **Then** the member sees *Changes requested* with the note and can edit and resubmit.
6. **Given** a submission, **When** the Admin declines it with a reason, **Then** it is never published, any stored file is deleted, and the member sees *Declined* with the reason.
7. **Given** any decision, **When** it is saved, **Then** the member is emailed without the file or link contents in the message.
8. **Given** a Moderator or member, **When** they request the queue or a decision, **Then** they are refused.

---

### User Story 3 - Attribution, including when staff publish for a member (Priority: P1)

Members browsing *Shared by members* see who shared each item. When a member emails a document to staff instead of submitting it, an Admin uploads it and picks that member as contributor; the item shows *Shared by* that member just as if they had submitted it.

**Why this priority**: The client asked for individual attribution explicitly, and it is how members tell peer material from Amend material.

**Independent Test**: Publish one approved member submission and one staff upload attributed to a member. Confirm both show *Shared by* with first name and last initial on list and detail pages, the contributor sees both on *My submissions*, and an Amend-source item shows no attribution line.

**Acceptance Scenarios**:

1. **Given** a published member item, **When** any member who can see it views the list or detail, **Then** it shows *Shared by* followed by the contributor's first name and last initial.
2. **Given** an Admin uploading a resource, **When** they choose a contributor, **Then** the picker offers active program members only, the source becomes *Members*, and an audit row records the attribution.
3. **Given** an Amend-source item, **When** it is shown, **Then** it has no contributor line.
4. **Given** a contributor whose account is later deactivated, **When** members view their items, **Then** the items stay published with the attribution as shown at publication, until an Admin removes them.
5. **Given** a contributor who has no displayable name, **When** they try to submit, **Then** they are asked to add a name first, as the forum does.

---

### User Story 4 - Member manages their own submissions (Priority: P2)

The member sees their housing guide is live. Later they spot a typo and edit the description; the edit goes to review while the original stays live. They withdraw a different submission they no longer need, and remove an old item they shared last year.

**Why this priority**: Members should not need to email staff to fix or retract their own material, but the core flow works without it.

**Independent Test**: As a member, edit a published item, withdraw a pending one, and remove a published one. Confirm the live version is unchanged until the edit is approved, the withdrawn item leaves the queue, the removed item disappears for every member, and audit rows exist.

**Acceptance Scenarios**:

1. **Given** a published item they contributed, **When** the member edits it, **Then** the edit enters review and the live version stays visible unchanged until approval.
2. **Given** an approved edit, **When** it is published, **Then** the item keeps its id, links, and download history.
3. **Given** a pending submission, **When** the member withdraws it, **Then** it leaves the queue and any stored file is deleted.
4. **Given** a published item they contributed, **When** the member removes it, **Then** it disappears from every member view at once and is retained for the audit period as a staff soft-delete is today.
5. **Given** another member's item, **When** a member tries to edit, withdraw, or remove it, **Then** they are refused without confirming it exists.

---

### User Story 5 - Report a shared item (Priority: P2)

A member sees a shared item that includes a photo of someone who did not agree to be shown. They choose *Report*, pick *Privacy*, and submit. The item enters the Admin queue as a report; the Admin removes it and the reporter is thanked.

**Why this priority**: PRD §5.7 asks for an escalation path for user-generated content in this setting. Review before publication catches most problems; reports catch the rest.

**Independent Test**: As a member, report a published member item. Confirm the report appears in the queue with reason and reporter (visible to Admin only), the item stays live until an Admin acts, and the Admin can remove it with one action.

**Acceptance Scenarios**:

1. **Given** a published member item, **When** a member reports it with a reason, **Then** a report is queued and an audit row is written; the contributor is not told who reported it.
2. **Given** a report, **When** an Admin removes the item, **Then** it disappears from every member view, and the contributor is told it was removed and why.
3. **Given** a report, **When** an Admin dismisses it, **Then** the item stays live and the report is closed.
4. **Given** the same member reporting the same item twice, **When** they submit, **Then** only one open report is kept.

### Edge Cases

- A member leaves a cohort while their submission targeting that cohort is pending: on approval the Admin must pick an audience the item can still have; the original choice is shown.
- A cohort is archived while a submission targets it: the submission can still be approved to that cohort, matching 014 FR-009 for already-chosen cohorts.
- A link later goes dead or changes content: members can report it; staff can remove it.
- A submitter is deactivated while items are pending: pending items stay in the queue labelled *Contributor inactive*; Admin decides.
- Two Admins act on the same submission at once: the first decision wins; the second sees it was already decided.
- A member submits a file that is identical to an existing resource: it is reviewed like any other; no automatic duplicate check.
- A member who opts out of the directory after sharing: published items keep their attribution; new submissions require a displayable name only (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Active members with a programme MUST be able to submit a resource as a file or an `http`/`https` link, with title (required), description (required, up to 500 characters), up to 10 topic tags, an optional thumbnail, and an audience. Cites PRD §5.5.
- **FR-002**: Member file submissions MUST be limited to PDF, DOCX, XLSX, PPTX, JPG, and PNG, up to 25 MB each. Staff limits from `004` FR-002 are unchanged.
- **FR-003**: Submissions MUST require all checklist items to be confirmed: no personal information about anyone else without their consent, no material identifying a person in custody, the member has the right to share it, and it follows the community guidelines. Cites PRD §5.7 compliance note.
- **FR-004**: The audience picker MUST offer only programmes and cohorts the member belongs to. The server MUST refuse any other audience, regardless of what the form sent. Cites Constitution I.
- **FR-005**: Uploaded files and thumbnails MUST pass the malware scan in the same request before the submission is saved; failures MUST store nothing, as in `004` FR-013 and FR-026. Cites PRD §8, Constitution III.
- **FR-006**: A pending, returned, declined, or withdrawn submission MUST be visible only to its submitter and to Admin and Super Admin. This MUST hold in page and handler checks, in query filters, and in database row-level policies with the application bypassed. Cites PRD §4, Constitution I.
- **FR-007**: Only Admin and Super Admin MUST be able to approve, return, or decline submissions and to act on reports. Moderators and members MUST be refused. Cites PRD §3.
- **FR-008**: Approval MUST publish the item in the same transaction as the decision, with source *Members* and the submitter as contributor. Reviewers MAY change title, description, tags, folder, thumbnail, and audience before approving, including widening the audience beyond the member's own groups.
- **FR-009**: Declining or withdrawing MUST delete any stored file and thumbnail for that submission. The submission record, reason, and audit rows MUST remain.
- **FR-010**: Published member items MUST show *Shared by* with the contributor's first name and last initial on list and detail pages. Amend-source items MUST NOT show a contributor.
- **FR-011**: Admins MUST be able to set a contributor when publishing or editing a resource, choosing from active program members; setting a contributor MUST set source *Members*.
- **FR-012**: Members MUST NOT be able to submit until their account has a displayable first or last name.
- **FR-013**: Link resources MUST open only after the same server-side visibility check as files, and MUST show the destination domain before the member leaves the site. Link URLs MUST NOT appear in analytics or audit metadata.
- **FR-014**: A member edit to a published item MUST create a pending revision; the live version MUST stay unchanged until an Admin approves the revision. Approval MUST keep the item id and download history.
- **FR-015**: Members MUST be able to withdraw their own pending submissions and remove their own published items. Removal MUST behave as staff soft-delete (`004` FR-017).
- **FR-016**: Members MUST be able to report a published member item with a reason (*Privacy*, *Inaccurate or harmful*, *Not mine to share*, *Other*). Reporter identity MUST be visible to Admin and Super Admin only. One open report per member per item.
- **FR-017**: Members MUST be limited to 5 submissions per day and 10 pending at once. Over-limit attempts MUST be refused with a neutral message.
- **FR-018**: The system MUST email a configured staff address on each new submission and report, and the member on each decision, using the existing email provider. Emails MUST NOT include file contents, link URLs, or other members' names.
- **FR-019**: The Admin dashboard and Admin → Resources MUST show the number of items waiting for review.
- **FR-020**: Submission, resubmission, approval, return, decline, withdrawal, member removal, contributor attribution, report, and report resolution MUST each write an append-only audit row in the same transaction as the change. Cites PRD §6 System 1, Constitution II.
- **FR-021**: Analytics MUST carry opaque ids and role labels only; never titles, names, link URLs, or reasons. Cites PRD §6 System 2.
- **FR-022**: Refusals MUST NOT reveal whether a submission, report, or member item exists.
- **FR-023**: Every state-changing request MUST be CSRF-protected. Cites PRD §8.
- **FR-024**: The permission matrix MUST gain rows for *Submit resource*, *Review submissions*, and *Report resource*, asserted through the application and directly against the database. Cites Constitution IV.
- **FR-025**: The in-app Guide MUST explain sharing, the checklist, review, attribution, and reporting to members, and the queue to staff. Community guidelines MUST be linked from the form.

### Key Entities *(include if feature involves data)*

- **Submission**: A member's proposed resource or revision. Has a submitter, kind (file or link), proposed metadata and audience, status (*waiting*, *changes requested*, *approved*, *declined*, *withdrawn*), reviewer, decision note, and timestamps. A revision points to the published item it would change.
- **Resource**: Existing library item, gaining a kind (file or link), an optional link URL, and an optional contributor.
- **Contributor**: The member credited on a *Members* item. Shown as first name and last initial.
- **Resource report**: A member's report on a published member item: reporter, reason, optional note, status (*open*, *removed*, *dismissed*), resolver.
- **Audit event**: Existing append-only record, extended with submission, decision, attribution, and report actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can submit a file or link in under 3 minutes from the Resources page, without staff help.
- **SC-002**: An Admin can approve, return, or decline a submission in under 1 minute from opening it.
- **SC-003**: In the permission proof, 100% of non-approved submissions are invisible to every member except their submitter, through the application and directly against the database.
- **SC-004**: 100% of published member items show a contributor line; 0% of Amend items do.
- **SC-005**: Staff publishing on a member's behalf is no longer needed for routine contributions: after one month, at least 80% of new *Shared by members* items come through the submission form.
- **SC-006**: 100% of declined and withdrawn submissions have no file left in storage after the decision.

## Assumptions

- PRD §3 *Upload / edit / delete resources* is read as *publish*. Member submission is a new, narrower capability that publishes nothing by itself. This interpretation is recorded in the assumptions log for Amend to confirm.
- Admin and Super Admin review, matching who publishes today. Moderators can be added later without redesign.
- A displayable name is required to submit, but a directory listing is not, because the name appears only on the shared item. **Default; to confirm with Amend** (the forum requires a listing).
- Member items without a thumbnail show a standard image for their file type or for links; reviewers may add a real thumbnail. This relaxes `004`'s required thumbnail for *Members* items only.
- The staff notification address is configured per environment. Staff emails go to that address, not to every Admin.
- Community guidelines text comes from Amend program staff (PRD §11 open question); the form links to it once it exists and blocks launch until then.
- Cohort audiences depend on `014-program-cohorts`. Before 014 ships, members choose from their programmes only.
