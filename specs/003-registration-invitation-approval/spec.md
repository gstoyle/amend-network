# Feature Specification: Registration, Invitation & Approval

**Feature Branch**: `003-registration-invitation-approval`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Start slice 002-registration-invitation-approval (PRD §5.2). Known open dependency: DOC affiliation field is a structured, admin-managed controlled list, not free text, per docs/decisions/assumptions-log.md (Q2, unconfirmed by Amend, developer assumption). Build against that. Note the dependency in spec.md. Cover: self-registration, admin bulk invite (CSV + manual), approval queue, DOC affiliation list management (admin CRUD), invite tokens."

**Cites**: PRD v1.1 §2 (invitation → activation and time-to-approve KPIs), §3 (roles, permission matrix, lifecycle), §5.2 (registration & invitation), §6 System 1 (lifecycle and admin audit events), §8 (PII at rest, CSRF), Appendix A.1 (User, Network, Invitation), Appendix B (public and admin routes); Constitution v1.0.0 Principles I, II, IV, V; Assumptions log Q2 (DOC affiliation controlled list) and Q3 (network list).

## Scope

This slice delivers **how people join the network**: a prospective member can request access; an Admin or Super Admin can invite a cohort; Admins review and approve or deny self-registrations; invitation links are single-use and time-limited; and the DOC affiliation values members choose come from an admin-managed list rather than free text.

A developer can run it locally against a local database, using the sign-in, session, role, pending holding page, and audit writer already delivered in `002-auth-rbac`. Production hosting is not part of this slice.

**In scope**

- Public self-registration (`/register`) that creates a Pending member and notifies the applicant and admins
- Admin/Super Admin invitation: manual entry and CSV upload (`/admin/users/invite`)
- Invitation records with single-use, 14-day tokens; public invite completion (`/invite/[token]`) that creates an **already-approved** member (invitation is the vetting)
- Pending Registrations queue (`/admin/users/pending`): oldest-first, filterable by requested network, approve (with optional network override) or deny
- Admin-managed DOC affiliation controlled list (add, edit label, deactivate) used on registration and invite-completion forms and as the CSV `doc_affiliation` vocabulary
- Lifecycle emails listed in PRD §5.2 (invite, self-reg confirmation, admin alert, welcome / set-password, polite denial, invite expiring soon, invite expired)
- Lifecycle and bulk-invite audit events this slice causes
- Permission-matrix proofs for **Approve / deny registrations** (and related invite/list management), run both through the application and with the application bypassed

**Out of scope**

- Sign-in, sessions, MFA, password reset, and the pending holding page shell (already `002-auth-rbac`; this slice only feeds Pending/Active/Denied users into that model)
- Member directory, field-level directory privacy toggles, and the approval-welcome directory opt-in (PRD §5.6) — this slice MUST still keep DOC affiliation out of analytics and MUST NOT show it to other members
- Events, announcements, resource library, forum, WordPress feed
- Full user-management roster beyond invite, pending queue, and enough detail to decide a pending record
- Network list CRUD (launch networks remain Pathways to Change and LEAD; see Q3)
- Pre-loading an existing membership file (PRD §11 Q9) — invitations are net-new
- Magic-link sign-in, WordPress SSO, hard-delete / data-subject flows
- Product analytics dashboards and invitation-funnel reporting UI (audit events this slice writes are the instrumentation those views will use later)
- DreamHost (or any production host) provisioning

### Open dependency — PRD §11 Q2 (DOC affiliation)

**This slice depends on an unresolved client question.** PRD §11 Q2 asks whether DOC affiliation is an agency name, facility, ID number, free text, or a controlled list. The constitution requires the spec to name that dependency and either stop or proceed on a recorded assumption.

**Proceed** on the named assumption in `docs/decisions/assumptions-log.md` (Q2, updated 2026-08-13): **structured, admin-managed controlled list, not free text.** Super Admin and Admin maintain valid values (add / edit / deactivate). Members **select** from active values at registration and invite completion; they do not type a free-text affiliation.

This is a **developer decision, not confirmed by Amend.** If Amend later requires free text, a different grain (facility vs agency vs ID), or Super-Admin-only list management, registration forms, CSV validation, encryption shape, and the list-management screen all change. Confirm with Amend before list-management work is expensive to reverse.

## User Scenarios & Testing *(mandatory)*

Primary actors: **prospective member** (unauthenticated), **invited token holder**, **pending member**, **Admin**, **Super Admin**. Moderators and ordinary members are secondary (they must be refused invite and approval paths). Unauthorized visitors must be refused without leaking whether an email already has an account.

### User Story 1 - Admin-managed DOC affiliation list (Priority: P1)

An Admin or Super Admin maintains the list of valid DOC affiliations. They can add a value, change its display label, and deactivate a value that should no longer be offered. Registration and invite-completion forms only offer **active** values. Deactivated values remain on file so existing members and historical invitations still make sense; they are not deleted.

**Why this priority**: Every join path in this slice requires a DOC affiliation, and Q2 says it is not free text. Without a managed list, self-registration and invitations cannot be specified or tested.

**Independent Test**: As Admin, add two active values and deactivate one. Open `/register` (signed out): only the active values appear. Confirm Moderator and members cannot open the list-management screen.

**Acceptance Scenarios**:

1. **Given** an Admin or Super Admin, **When** they add a DOC affiliation value, **Then** that value appears as a selectable option on the public registration form and the invite-completion form.
2. **Given** an active value, **When** an Admin edits its label, **Then** the new label is what members see, and prior selections of that value show the updated label.
3. **Given** an active value, **When** an Admin deactivates it, **Then** new registrations and new invitations cannot select it, and it no longer appears in the public dropdown.
4. **Given** a member or Moderator, **When** they request the list-management screen, **Then** they are denied (no list data returned).
5. **Given** a deactivated value that some members already hold, **When** an Admin views those members or pending records, **Then** the historical affiliation is still visible to that Admin; it is not erased.

---

### User Story 2 - Self-registration into Pending (Priority: P1)

A prospective member opens `/register` without an invitation, fills the required fields (first name, last name, DOC affiliation from the active list, title/role, email, network, password), and submits. They receive a confirmation that the request was received. Admins receive an alert that a new pending record exists. The person becomes a Pending member: they can sign in only to the holding page already provided by authentication work; they cannot see member content. They cannot tell from the form whether their email is already in the system.

**Why this priority**: Uninvited join is the open front door; it must create a reviewable Pending user without granting cohort access (PRD §5.2, §3).

**Independent Test**: With at least one active DOC affiliation and both networks available, submit a new email at `/register`. Confirm confirmation email to the applicant, admin alert, Pending status, holding-page-only access, and a generic message when the same email is submitted again.

**Acceptance Scenarios**:

1. **Given** a visitor with an email that is not already in the system, **When** they submit a complete registration form, **Then** a user exists in Pending status with the submitted fields, requested network, and chosen DOC affiliation, and they cannot open member content routes.
2. **Given** a successful self-registration, **When** emails are sent, **Then** the applicant gets a receipt confirmation and admins get a new-pending alert. Neither message includes a DOC affiliation in any analytics or public copy beyond what the applicant already entered.
3. **Given** an email that already belongs to an active, pending, denied, or deactivated account, **When** a visitor submits `/register` with that email, **Then** they see the same generic eligible-if-applicable message as a successful new request, and no account state is revealed.
4. **Given** a pending member with the correct password, **When** they sign in, **Then** they reach only the holding page (existing pending behavior); they still cannot see resources, directory, forum, or events.
5. **Given** the registration form, **When** a visitor inspects network and DOC affiliation controls, **Then** network options are the launch networks only, and DOC affiliation is a choice from active list values, not a free-text box.

---

### User Story 3 - Approval queue (Priority: P1)

An Admin or Super Admin opens `/admin/users/pending` and sees self-registrations waiting for a decision, oldest first, filterable by requested network. Each row shows the submitted fields, when it was submitted, and the request IP (for admin review only). Approving assigns the program role (default: the requested network; the admin may choose the other launch network) and activates the account; the member gets a welcome email (or a set-password email if they somehow have no password). Denying archives the record; the person gets a polite decline with **no** specific reason; any admin-entered reason stays on the audit trail only.

**Why this priority**: Self-registration must not grant cohort access until a human vets the request (PRD §5.2). Time-to-approve is a launch KPI.

**Independent Test**: Create two pending users on different networks. Filter, approve one (optionally changing network), deny the other with a reason. Confirm the approved user can sign in to the member home, the denied user cannot sign in, emails match the rules above, and a Moderator cannot open the queue.

**Acceptance Scenarios**:

1. **Given** several pending registrations, **When** an Admin opens the queue, **Then** records appear oldest-first and can be filtered by requested network.
2. **Given** a pending record, **When** an Admin views it, **Then** they see submitted name, title, email, DOC affiliation, requested network, submission time, and request IP. Other members never see that IP.
3. **Given** a pending record, **When** an Admin approves it without changing network, **Then** the user becomes an active member of the requested program (Pathways or LEAD), can sign in to the member home, and receives a welcome email.
4. **Given** a pending record, **When** an Admin approves it onto the other launch network, **Then** the assigned program role matches that choice, not the original request.
5. **Given** a pending record, **When** an Admin denies it with an optional reason, **Then** the account is archived (not deleted), the person receives a polite email with no reason, and the reason is retained only for admins/audit.
6. **Given** a Moderator, Pathways member, or LEAD member, **When** they request the pending queue or attempt approve/deny, **Then** they are denied and no pending PII is returned.

---

### User Story 4 - Admin invitation (manual and CSV) and invite tokens (Priority: P1)

An Admin or Super Admin opens `/admin/users/invite` and either enters people by hand (email, first name, last name, network) or uploads a CSV with columns `email`, `first_name`, `last_name`, `network_name`, `title`, `doc_affiliation`. The file is checked before send. Bad rows (missing required fields, email already a member or already having an unused invite, unknown network, DOC affiliation that is missing or not an **active** list value) appear in an error report; the admin can fix and resubmit only those rows. Each valid person gets an Invitation with a single-use token that expires in 14 days and an email containing the unique link and that expiry.

The recipient opens the link and sees a registration form with name and network filled in and email locked. They complete remaining required fields (password always; title and DOC affiliation if not already supplied) by selecting DOC affiliation from the active list. Submitting creates them **directly as an active member of the invited network** — no pending step. Using the same link again after success tells them the invitation was already used and to sign in or request a password reset.

**Why this priority**: Bulk invite is how a known cohort is onboarded without a queue bottleneck; the token is the security boundary for that path (PRD §5.2).

**Independent Test**: Invite one person by hand and two via CSV (one valid row, one invalid). Confirm only the valid invites send, the invalid row is reported, the valid link completes to an active Pathways or LEAD member, a second click is refused as already used, and a self-registered pending user is not created.

**Acceptance Scenarios**:

1. **Given** an Admin, **When** they submit a valid manual invite, **Then** an unused invitation exists for that email and network, an invite email is sent with a unique link and 14-day expiry, and a `invitation_sent` (and, for more than one send in one action, `bulk_invite_sent` as appropriate) audit record exists.
2. **Given** a CSV with mixed valid and invalid rows, **When** an Admin uploads it, **Then** valid rows produce invitations and emails, invalid rows do not, and the error report names the problems (missing fields, duplicate/existing email, unknown network, inactive or unknown DOC affiliation) so only bad rows need resubmission.
3. **Given** a valid unused invite link, **When** the recipient opens it, **Then** they see name and network pre-filled, email not editable, and they must set a password; DOC affiliation is a list selection (pre-selected if the CSV supplied a valid active value).
4. **Given** that form, **When** they submit complete valid fields, **Then** they become an active member of the invited network immediately (not Pending), can sign in to the member home, and the token cannot be used again.
5. **Given** a consumed invite link, **When** anyone opens it, **Then** they see that the invitation has already been used and are directed to sign in or request a password reset — not to register again.
6. **Given** a Moderator or member, **When** they request `/admin/users/invite`, **Then** they are denied.

---

### User Story 5 - Invite expiry, reminders, revoke, and re-issue (Priority: P2)

Unused invitations expire 14 days after send. Three days before expiry, the invited person and the inviting admin are reminded. When an invitation expires unused, the inviting admin is notified so they can re-issue. An Admin or Super Admin can revoke an unused invitation. Expired or revoked links cannot complete registration. Re-issuing creates a **new** token and 14-day window; the old token stays unusable.

**Why this priority**: Tokens that live forever are an access hole; ops need revoke and re-issue to run a cohort (PRD §5.2 emails and 14-day retention).

**Independent Test**: Create invitations in states unused, expired, revoked, and accepted. Confirm only unused-and-unexpired links complete; reminders and expiry notices fire on the documented schedule in a local test clock; revoke immediately disables the link.

**Acceptance Scenarios**:

1. **Given** an unused invitation older than 14 days, **When** the recipient opens the link or a sweep runs, **Then** registration cannot complete and the inviting admin is notified that it expired.
2. **Given** an unused invitation 3 days from expiry, **When** the reminder is due, **Then** the invited person and the inviting admin each receive an expiring-soon notice.
3. **Given** an unused invitation, **When** an Admin revokes it, **Then** the link stops working immediately and a later completion attempt fails closed.
4. **Given** an expired or revoked invitation, **When** an Admin re-issues to the same email, **Then** a new unused invitation and link exist, and the previous token still cannot be used.

---

### Edge Cases

- Duplicate self-registration email (active, pending, denied, deactivated): same generic visitor message; no indication which state it is.
- Self-registration missing required fields or using an inactive/unknown DOC affiliation: form rejected; no user created.
- CSV row email matches an unused invitation: treat as invalid (do not send a second live invite); admin revokes or waits, then resubmits.
- CSV row email matches a consumed invitation whose user is already a member: treat as existing member (invalid row).
- Two Admins approve or deny the same pending record: only the first decision applies; the second sees that it is no longer pending.
- Admin denies without a reason: allowed; user email still has no reason.
- Invite link after sign-in as a different user: completion must not attach the invited profile to the wrong session; fail closed and ask to sign out / use the invite signed-out.
- Token that is malformed, unknown, or tampered: same unusable-invitation outcome as expired — no leak of whether a token ever existed vs expired.
- Re-click of a consumed token vs opening an expired unused token: consumed copy matches PRD (“already been used… log in or request a password reset”); expired unused does not imply an account exists.
- Deactivating the last DOC affiliation: new self-registration and invite completion cannot satisfy the required DOC field until an active value exists; admins are not blocked from deactivating but cannot complete joins until at least one active value remains.
- Pending user whose requested network is later removed from launch list: out of scope (Q3 stays two networks).
- Invite completion with a DOC value that was deactivated after the invite was sent: the pre-selected value is not selectable; the person must choose a currently active value.
- Request IP missing (local or privacy relay): pending record still created; IP shown as unavailable to the admin, not invented.
- Moderator with MFA: still cannot invite, approve, deny, or manage the DOC list.
- Client-supplied role or “approve myself” on a public form: ignored; only Admin/Super Admin decisions and valid invite tokens change status.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Prospective members MUST be able to submit self-registration at `/register` without an invitation. Required fields: first name (trimmed, max 80), last name (trimmed, max 80), DOC affiliation (selection from **active** controlled-list values), title/role (free text), email (unique login identifier), network name (dropdown of launch networks), password (same policy as sign-in: at least 12 characters, no composition rules). Cites PRD §5.2.
- **FR-002**: A successful self-registration MUST create a user in Pending status with `program_role` unset for cohort access (`none` until approval) and MUST NOT grant member content. Cites PRD §3 lifecycle and §5.2.
- **FR-003**: Successful self-registration MUST send a confirmation to the applicant and a new-pending alert to the admin group address. Duplicate or ineligible emails MUST still show the visitor the same generic success-style message (“if this email is eligible, you will receive instructions”) and MUST NOT send a second “you are pending” confirmation that would reveal an existing account.
- **FR-004**: User-visible registration and invitation errors MUST NEVER leak account existence, status, or reason to unauthenticated visitors. Admin-facing CSV/manual invite errors MAY name why a row failed (existing member, bad network, bad DOC value) because the actor is already authorized.
- **FR-005**: Admins and Super Admins MUST invite from `/admin/users/invite` by manual entry (email, first name, last name, network) and by CSV with columns `email`, `first_name`, `last_name`, `network_name`, `title`, `doc_affiliation`. Moderators and members MUST be denied.
- **FR-006**: CSV MUST be validated before send. Rows with missing required fields, emails that already have an account or an unused invitation, unknown network names, or DOC affiliations that are missing or not an **active** list value MUST appear in an error report. Valid rows MUST still be processed; the admin MUST be able to correct and resubmit only the bad rows.
- **FR-007**: Each valid invite MUST create an Invitation: cryptographically random single-use token (≥128 bits of entropy), token stored hashed (never recoverable from storage or logs), `expires_at` = send time + 14 days, status unused until accepted, expired, or revoked. The invite email MUST include the unique link and the 14-day expiry. Cites PRD §5.2, §6 retention.
- **FR-008**: Opening a valid unused, unexpired invite link MUST show a pre-filled form (name and network populated, email locked). Submission MUST set the password and remaining required fields and MUST create the user **already active** in the invited program role — no pending queue. Cites PRD §5.2 (invitation is the vetting).
- **FR-009**: Consumed invite tokens MUST be single-use. A second use MUST show that the invitation has already been used and MUST direct the person to sign in or request a password reset. Expired, revoked, unknown, or tampered tokens MUST NOT complete registration.
- **FR-010**: Admins and Super Admins MUST see Pending Registrations at `/admin/users/pending`, sorted oldest-first, filterable by requested network. Each record MUST show submitted fields, submission timestamp, and request IP for admin review only. IP MUST NEVER be shown to other members or sent to product analytics.
- **FR-011**: Approval MUST assign a program role defaulting to the requested network, allow the Admin to choose the other launch network instead, activate the account, and email the user a welcome message — or a set-password link if no password exists. Denial MUST archive (not delete) the record, email a polite decline with no specific reason, and keep any admin reason on the audit trail only. Cites PRD §5.2, §3.
  - **Deviation (deliberate, not an oversight)**: The admin-entered denial reason is stored AES-256-GCM-encrypted on the user row (`denial_reason_encrypted`), not in `audit_log.metadata`. `registration_denied` metadata is only `{ has_reason: boolean }`. The reason therefore survives independently of audit retention, and is removed if the user is later hard-deleted.
- **FR-012**: Only Super Admin and Admin MAY approve, deny, send invitations, revoke or re-issue invitations, or manage the DOC affiliation list. Every one of those paths MUST use the signed session’s administrative role (layer 2) and MUST fail closed for Moderator and program members. Cites PRD §3 matrix, Constitution I.
- **FR-013**: Super Admin and Admin MUST be able to add, edit the label of, and deactivate DOC affiliation list values. Values MUST NOT be hard-deleted. Public and invitee forms MUST offer only active values. Cites assumptions log Q2.
- **FR-014**: A member’s selected DOC affiliation MUST be treated as PII: encrypted at rest with application-layer AES-256-GCM; never sent to product analytics; never shown in a directory or to other members in this slice. List labels themselves are shared vocabulary, not a person’s PII, but the **association** of a person to a value is PII. Cites PRD §5.2 compliance note, §8, Constitution II.
- **FR-015**: Title, names, and email on join records MUST remain encrypted at rest under the same PII rules as `002-auth-rbac`. Email MUST remain usable as the unique login identifier.
- **FR-016**: Unused invitations MUST expire at 14 days. An expiring-soon notice MUST go to the invited person and the inviting admin 3 days before expiry. An expired-unused notice MUST go to the inviting admin. Admins MUST be able to revoke unused invitations and to re-issue (new token, new 14-day window; old token remains unusable).
- **FR-017**: This slice MUST emit audit events: `invitation_sent`, `invitation_accepted`, `invitation_expired`, `registration_submitted`, `registration_approved`, `registration_denied`, `bulk_invite_sent`, `role_assigned`. DOC list add/edit/deactivate MUST write `system_setting_changed`. Revoke and re-issue MUST write append-only audit rows identifying the invitation and actor (map in planning if a dedicated action name is added). Writes MUST be synchronous in the same transaction as the change. Cites PRD §6, Constitution II.
- **FR-018**: CSRF protection MUST apply to every state-changing registration, invitation, approval, and list-management request. Cites PRD §8.
- **FR-019**: Hostnames, admin-alert mailbox, and mail sender settings MUST come from environment variables only. The slice MUST run locally with a captured/local mailbox and a local database. Cites Constitution III.
- **FR-020**: Secrets, raw invite tokens, password hashes, and DOC affiliation plaintext MUST NEVER appear in Git, recoverable test fixtures, or log lines.
- **FR-021**: Every route handler this slice adds MUST have a test that it rejects an unauthorized role, not only that it accepts an authorized one. Approve/deny and invite capabilities MUST be asserted in the permission matrix on both the application run and the application-bypassed database run. Cites Constitution IV.
- **FR-022**: New registration, invite-completion, pending-queue, invite, and DOC-list screens MUST meet Constitution V accessibility rules (labeled fields, 44×44 targets, token-only styling, no hard-coded visual values).
- **FR-023**: Invited token holders MUST NOT be able to sign in until they complete the invite form. Completing the form is what creates the loginable user.

### Key Entities

- **User**: Extended with title, selected DOC affiliation (PII), requested or assigned network, and join path (self-registered vs invited). Status values already defined: `pending` | `active` | `deactivated` | `denied`.
- **Network**: Launch values Pathways to Change and LEAD only (Q3). Maps to program role at approval or invite completion.
- **DOC affiliation value**: Admin-managed controlled-list entry (label, active/deactivated, who changed it and when). Members select; they do not author the vocabulary.
- **Invitation**: Email, hashed token, inviter, network, optional pre-filled name/title/DOC affiliation, status (`pending`/`unused` | `accepted` | `expired` | `revoked`), expiry. Does not grant login until accepted.
- **Pending registration (admin view)**: The pending user plus submission time and request IP for vetting.
- **Audit log**: Append-only rows for the lifecycle events in FR-017; no updates.

### Constraints (mandated by PRD §5.2 / §3 / §6 / §8 and Constitution; not open design)

This slice does not re-open authentication, authorization, or hosting choices. Plan and tasks MUST reuse `002-auth-rbac` sessions, `requireRole` from the signed session, native database row-level security, password hashing policy, PII encryption, and the append-only audit writer. Do not introduce a third-party identity vendor, magic links, or client-supplied roles. Invite tokens follow the same “store hashed, send raw once” pattern as password-reset tokens. DOC affiliation is a controlled list per the Q2 assumption above — not a free-text column.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new prospective member can complete self-registration in under 3 minutes (all required fields available, including at least one active DOC affiliation).
- **SC-002**: After self-registration, 100% of attempts to open member content (resources, directory, forum, events) as that user fail; only the holding page succeeds.
- **SC-003**: Duplicate-email self-registration shows the same visitor-facing message as a first-time submission in 100% of tested existing-account states (active, pending, denied, deactivated).
- **SC-004**: An Admin can finish a single approve or deny decision from the pending queue in under 2 minutes, including seeing submitted fields and (for deny) an optional reason that never appears in the applicant email.
- **SC-005**: 100% of invite completions with a valid unused token create an active member of the invited network with no pending wait. 100% of second uses of that token refuse completion.
- **SC-006**: 100% of expired, revoked, unknown, and tampered invite links refuse completion.
- **SC-007**: A mixed CSV processes every valid row into an invitation and returns a report that accounts for 100% of invalid rows; no invalid row produces a sent invite.
- **SC-008**: New registration and invite-completion forms offer 0 free-text DOC affiliation inputs and 0 deactivated list values.
- **SC-009**: Product analytics payloads for this slice contain 0 DOC affiliation values, emails, names, or titles (opaque user ids and role labels only).
- **SC-010**: Moderators and program members succeed at 0 invite, approve, deny, or DOC-list-management attempts on both the application check and the application-bypassed data check.
- **SC-011**: Unused invitations cannot be completed after 14 days; re-issue restores a new 14-day window without reactivating the old link.
- **SC-012**: Each FR-017 event produced by a successful test action yields exactly one new audit row; existing rows cannot be changed through any product path.
- **SC-013**: A developer following local steps can self-register, invite via CSV, approve a pending user, and complete an invite token against a local database and captured mailbox with no production host.

## Assumptions

Named assumptions below are **recorded**, not silent. Constitution v1.0.0 requires this for PRD §11 dependencies.

### PRD §11 dependencies

| Question | Relevance to this slice | Decision in this spec |
| --- | --- | --- |
| **Q2** DOC affiliation field | Registration form, CSV column, encryption, directory/analytics rules, list-management UI | **Proceed** on **structured, admin-managed controlled list (not free text)** per `docs/decisions/assumptions-log.md` (updated 2026-08-13). Super Admin **and** Admin may CRUD (deactivate, not hard-delete). **Unconfirmed by Amend.** Revisit before list-management is costly to undo. Directory opt-in for this field remains a later slice; this slice still encrypts the person’s selection and keeps it off analytics and off other members’ screens. |
| **Q3** Network name list | Dropdowns, CSV `network_name`, approval default role | **Proceed** on **Pathways to Change and LEAD only**, same as `002-auth-rbac`. Assumptions log says revisit before this slice ships — still two networks unless Amend adds more. Network list CRUD is out of scope. |
| **Q6** Email provider | All §5.2 notification triggers | **Proceed** locally with a captured/local mailbox. Production sender remains later wiring. Admin-alert recipient is an environment-configured group address, not a hard-coded mailbox. |
| **Q9** Existing membership list | Invite volume and queue sizing | **Proceed** as **net-new invitations**. No pre-load in this slice. |
| **Q10** Multilingual | Form copy | **Proceed** English-only. |
| **Q11** Super Admin structure | Who may approve and manage lists | **Proceed** with multiple Admins and Super Admins allowed. Both roles may invite, approve/deny, and manage DOC list values. Only those two roles. |
| **Q12** Directory visibility default | Welcome flow toggle in §5.6 | **Not in this slice.** Do not add directory opt-in here. Do not display DOC affiliation to other members. |
| **Q14** Future WordPress SSO | Join path design | **Proceed** with email-and-password only. Do not add SSO-ready registration beyond keeping email as the unique identifier. |

### Other assumptions

- **Invitation skips Pending**: PRD §3’s generic lifecycle says Invited → Pending. PRD §5.2’s invitation acceptance criteria are more specific and win: completing an invite creates an **active** member because the invitation is the vetting. Self-registration is the path that uses Pending.
- **Invitation status names**: PRD Appendix A uses `pending` for an unused invite. That is invitation status, not user status. This spec treats unused invites as not-yet-accepted; user Pending applies only to self-registered accounts awaiting approval.
- **Manual invite vs CSV fields**: Manual invite requires email, first name, last name, and network. Title and DOC affiliation may be omitted there and **must** be completed on the invite form. CSV may supply title and DOC affiliation; if supplied, DOC affiliation MUST match an active list value or the row is invalid.
- **CSV size**: A single upload is assumed to stay within a few hundred rows (documented ceiling of 500) so the error report stays usable. Larger official imports are Q9/later work.
- **Email matching**: Invite and registration treat email as case-insensitive uniqueness.
- **Password on self-registration**: Always required, so the common approval email is “you’re in.” The set-password-on-approval branch remains only if a pending user has no password.
- **Pending profile edits**: Full `/app/profile/edit` is out of scope. Holding page from `002-auth-rbac` remains the pending experience.
- **DOC list vs system settings**: Although “change system configuration” is Super Admin only in the matrix, the Q2 assumption places this vocabulary next to day-to-day user administration, so **Admin and Super Admin** both manage it. It is not buried in Super-Admin-only system settings.
- **Invite completion while signed in**: Users complete invites signed out. A mismatched existing session must not take over the invited account.
- **Landing “Request access”**: `/register` is reachable directly. Wiring a marketing landing CTA is included if that landing already exists; building the marketing landing is not this slice’s goal.
- English-only UI; local Secure-cookie and mailbox conventions from `002-auth-rbac` still apply.
