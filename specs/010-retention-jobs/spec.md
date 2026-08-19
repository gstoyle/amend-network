# Feature Specification: Data Retention Jobs

**Feature Branch**: `010-retention-jobs`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Start slice 010-retention-jobs (PRD §6 data retention policy). Cover: weekly background job enforcing retention rules — audit log security events retained 7 years, non-security events 3 years, product analytics events 24 months, deactivated user records anonymized after 3 years of inactivity, and cleanup of already-short-lived items (expired password reset tokens, expired invitation tokens) that may have accumulated without cleanup. All retention deletions must themselves write an audit_log row recording the row count deleted, per PRD §6. Reuse the existing sweep pattern from lib/registration/sweep.ts (invitation expiry) — local/cron-invocable function, not a new HTTP route, no production cron wiring (that stays infra/ work per Constitution III)."

**Cites**: PRD v1.1 §6 Data retention policy (table and weekly job + deletion trail rows with counts), §6 System 1 (rows never updated or deleted *within* the retention window), §5.1 password-reset lifetime (60 minutes), §5.2 invitation lifetime (14 days), §8 (PII at rest; self-service deletion is a separate path); Constitution v1.0.0 Principles I (job is not a member data path; it still must not invent a public bypass), II (PII shrink; trail append-only *inside* the window; deletion evidence is a new row), III (production schedule lives in operations, not this slice), IV (fail-first proofs with a frozen clock); existing invitation-expiry sweep as the invocation pattern. **PRD §11 Q7** — proceeds on the PRD default periods (`docs/decisions/assumptions-log.md`).

## Scope

This slice delivers the **weekly retention pass** that stops evidence and leftover secrets from accumulating forever. It is an **operator job**, not a staff screen and not a member self-service flow. It removes or anonymizes only what the retention table already allows. It records every successful deletion class as a **new** trail row with a count. It does not change how sign-in, invites, or analytics are recorded day to day.

Inside each class’s window, the trail stays append-only: this job is the authorized exception **after** the window, matching PRD’s “never deleted within the retention window.”

**In scope**

- One locally invocable weekly job, same shape as the existing invitation-expiry sweep (injectable clock; no new web address)
- Audit trail: drop **security** events older than **7 years**; drop **other** trail events older than **3 years**
- Product analytics events older than **24 months**
- Deactivated member records: **anonymize** after **3 years of inactivity** — shrink personal-detail copies (account row, leftover directory listing and shown-field copies, leftover sessions and password-reset tokens) while **keeping the account identifier** and leaving resource uploader / event host / announcement creator identifiers unchanged
- Leftover **expired password-reset tokens** and **expired or revoked invitation tokens** that can no longer be used
- For each deletion class that actually removes rows, append one trail row that records the class and the count, with no names, emails, tokens, or other PII in that row
- Those deletion-trail rows are **ordinary non-security** evidence. They follow the same **3-year** window as any other non-security trail row. They are not a permanent “record of deletions” and MUST NOT accumulate without bound.

**Out of scope**

- Attaching the job to production weekly timers, systemd, or host cron (`infra/` / Constitution III)
- A staff or member web address, button, or API route that runs the job
- Super Admin screens to change retention periods (PRD “retention settings” under Change system configuration)
- Member “My data” export or Super Admin hard-delete / data-subject fulfillment (PRD §8)
- Replacing the existing invitation-expiry sweep (pending invites still expire at 14 days there; this slice only **removes leftover unusable tokens**)
- Session-cookie absolute expiry (already 30 days in authentication)
- Backup dump lifetimes, object-storage cleanup of withdrawn files, or WordPress feed cache
- Forum-only records (forum is not built)
- Changing day-to-day audit or analytics instrumentation
- A separate immortal table or severity class whose only job is to remember that deletions happened
- Rewriting resource uploader, event host, or announcement creator identifiers when anonymizing an account

## Clarifications

### Session 2026-08-18

- Q: Do trail rows that record this job’s own deletions persist indefinitely, or age out like other non-security evidence? → A: Ordinary non-security, 3-year retention. An unbounded record of deletions would defeat retention. Same-run exception: a deletion-trail row written in this run is not deleted in that same run.
- Q: When the job anonymizes a deactivated account after 3 years of inactivity, which stored copies of that person’s identity must it shrink, and must those writes go through the same personal-data encryption helpers the rest of the product uses? → A: Personal-detail copies only (account row plus leftover directory listing and shown-field copies, leftover sign-in sessions, and leftover password-reset tokens). Resource uploader, event host, and announcement creator identifiers stay. Replacement values for encrypted personal fields go through the product’s existing encryption helpers, not a raw database bypass.

## User Scenarios & Testing *(mandatory)*

Primary actor: **the weekly job** (run by operations, or locally in tests). **Super Admin / Admin / members** have no new screens. Unauthorized people must not be able to trigger the pass through the product.

### User Story 1 - Age out audit evidence after the policy window (Priority: P1)

Amend keeps a tamper-resistant trail for compliance, but not forever. A weekly pass removes security-severity trail rows older than seven years and all other trail rows older than three years — including earlier deletion-trail rows that this job wrote. Rows still inside those windows stay. Each class that deleted anything leaves a new **non-security** trail row stating how many were removed. That new row is not an edit of the old ones, and it is not kept forever.

**Why this priority**: 7-year security retention and 3-year operational retention are the PRD’s records-management obligation; unbounded trail growth is a launch risk.

**Independent Test**: Freeze the clock. Seed one security trail row 7 years + 1 day old, one security row 6 years old, one non-security row 3 years + 1 day old, one non-security row 2 years old, one deletion-trail row 3 years + 1 day old, and one deletion-trail row 2 years old. Run the job. Confirm the over-limit rows (including the old deletion-trail row) are gone, the in-window rows remain unchanged, and each deletion class that removed rows in this run has exactly one new trail row whose count matches. The new deletion-trail rows from this run are still present.

**Acceptance Scenarios**:

1. **Given** a security trail row older than 7 years, **When** the weekly job runs, **Then** that row is gone and younger security rows remain.
2. **Given** a non-security trail row older than 3 years — including a deletion-trail row this job wrote in a prior year — **When** the job runs, **Then** that row is gone and younger non-security rows remain (including security rows still inside 7 years).
3. **Given** a successful deletion of at least one row in a class, **When** the job commits, **Then** exactly one new non-security trail row exists for that class with the deleted count, no prior remaining trail row was changed, and that new row is not removed in the same run.
4. **Given** a second run against the same fixtures with the same clock, **When** the job runs again, **Then** it deletes 0 additional in-window rows and does not add another deletion trail row for a class that had nothing left to remove.
5. **Given** the job, **When** it runs, **Then** it is not exposed as a staff or member web page.

---

### User Story 2 - Shrink PII on long-deactivated accounts (Priority: P1)

A deactivated account that has been inactive for three years should stop holding recoverable personal details. The job clears the **account row’s** personal fields (name, email, title, DOC affiliation, denial notes, MFA material) and any leftover **directory listing or shown-field copies**, leftover **sign-in sessions**, and leftover **password-reset tokens**. It **keeps the same account identifier** so historical trail rows and content attribution (who uploaded a resource, who hosted an event, who created an announcement) still point at that person as an opaque id — without a recoverable name. Active accounts and recently deactivated accounts are untouched. Replacement values for encrypted personal fields use the **same personal-data protection** the product already uses when storing those fields; the job must not write around it.

**Why this priority**: PRD keeps deactivated records indefinitely but requires anonymization after 3 years of inactivity so the PII surface shrinks without breaking audit integrity.

**Independent Test**: Freeze the clock. Seed (a) deactivated with no activity for 3 years + 1 day, still holding a leftover directory listing/shown-field copy, a session, a reset token, and a resource they uploaded; (b) deactivated 2 years ago; (c) active with old last activity. Run the job. Confirm only (a) has unrecoverable personal details, no directory copies, no leftover sessions or reset tokens, and their uploaded resource still names the same account id; (b) and (c) still have original recoverable details; one trail row records how many accounts were anonymized.

**Acceptance Scenarios**:

1. **Given** a deactivated account with no successful sign-in (and, if they never signed in, no other activity) for more than 3 years since deactivation, **When** the job runs, **Then** stored personal details on the account are no longer recoverable, leftover directory listing and shown-field copies are gone, leftover sign-in sessions and password-reset tokens for that person are gone, and a leftover directory copy planted after deactivation is also gone.
2. **Given** that account, **When** staff later inspect historical trail rows or content that names its identifier (resource uploader, event host, announcement creator), **Then** those records still exist (trail rows subject to Story 1 windows) and still point at the same identifier — they are not blanked.
3. **Given** an active account, or a deactivated account inside the 3-year inactivity window, **When** the job runs, **Then** their personal details, directory copies, and content attribution are unchanged.
4. **Given** at least one account anonymized, **When** the job commits, **Then** one new trail row records the count, without names or emails.
5. **Given** replacement values written onto encrypted personal fields, **When** those fields are read through the product’s normal personal-data path, **Then** they do not yield the original name, email, title, or DOC affiliation. A write that skipped that path is not acceptable.

---

### User Story 3 - Clear leftover short-lived tokens (Priority: P2)

Password-reset tokens are meant to last 60 minutes and invitation tokens 14 days. Expiry of *pending* invitations is already a separate sweep. This pass deletes tokens that are **already unusable** (password-reset past expiry or already used; invitations already expired or revoked) so hashed secrets and invitee PII do not sit indefinitely.

**Why this priority**: The lifetimes already exist; leftover rows are an accumulation hole the weekly job is specified to close.

**Independent Test**: Freeze the clock. Seed an expired unused reset token, a still-valid reset token, an expired invitation, a revoked invitation, and a pending invitation still inside 14 days. Run the job. Confirm only unusable reset and invitation tokens are gone; the valid reset and pending invite remain; counts on trail rows match.

**Acceptance Scenarios**:

1. **Given** password-reset tokens past 60 minutes or already used, **When** the job runs, **Then** those tokens cannot be used and their stored hashes are gone.
2. **Given** a password-reset token still inside 60 minutes and unused, **When** the job runs, **Then** it still works.
3. **Given** invitations already expired or revoked, **When** the job runs, **Then** their tokens cannot be redeemed and the leftover invitee personal details on those rows are gone.
4. **Given** a pending invitation still inside 14 days, **When** the job runs, **Then** it is not deleted (the existing expiry sweep still owns marking it expired later).
5. **Given** deletions in these classes, **When** the job commits, **Then** each class that removed rows has one trail row with the count, without token values or emails.

---

### User Story 4 - Age out product analytics events (Priority: P3)

Engagement insight is not evidence. Product analytics events older than 24 months are removed so trend analysis covers two program cycles without open-ended accumulation. The audit trail is not used as the analytics store. A deletion in this class is recorded on the audit trail with a count, like the other classes.

**Why this priority**: PRD separates analytics retention (24 months) from the audit trail; required for the weekly pass, but lower severity than evidence and PII.

**Independent Test**: Freeze the clock. Seed analytics events 24 months + 1 day old and 12 months old. Run the job. Confirm only the older events are gone, the younger remain, and one trail row records the deleted count if any were removed.

**Acceptance Scenarios**:

1. **Given** product analytics events older than 24 months, **When** the job runs, **Then** those events are gone and newer analytics events remain.
2. **Given** audit trail rows inside their own windows, **When** the analytics class runs, **Then** those trail rows are not removed as if they were analytics events.
3. **Given** at least one analytics event deleted, **When** the job commits, **Then** one new trail row records the count, without names, emails, or free-text content.

---

### Edge Cases

- A security trail row between 3 and 7 years old is **kept** (security window, not the shorter operational window).
- A non-security trail row 3 years + 1 day old is **removed** even if the same person’s security events are kept.
- The trail row that records a deletion is new **non-security** evidence; it is not deleted in the same run that wrote it. After 3 years it is deleted like any other non-security row. There is no immortal “record of deletions.”
- A class with nothing to delete writes **no** extra trail row (counts are only recorded when something was removed).
- Running the job twice with the same clock is safe: second pass is a no-op for already-cleaned fixtures.
- Anonymization does not reactivate, delete, or change program/admin role; it only removes recoverable personal details. Resource uploader, event host, and announcement creator identifiers are **not** blanked.
- Leftover directory listing or shown-field copies that somehow survived deactivation are removed by this pass; their absence is required even if a prior slice should already have deleted them.
- Denied or pending accounts are not anonymized by this pass (PRD class is deactivated records).
- Invitation expiry **emails** are not sent from this job (existing expiry sweep owns that).
- Failure part-way through a class does not leave a trail row claiming a count that was not actually removed (count and deletion share one unit of work).
- Clock is injectable so tests do not wait years.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A single weekly retention pass MUST enforce all in-scope classes in one invocation. Cites PRD §6 weekly background job.
- **FR-002**: The pass MUST be invocable locally with an injectable “now,” in the same style as the existing invitation-expiry sweep. It MUST NOT be a staff or member web address. Production weekly scheduling MUST remain operations work. Cites Constitution III; existing sweep pattern.
- **FR-003**: Audit trail rows with security severity older than **7 years** MUST be deleted. Younger security rows MUST remain. Cites PRD §6 security events.
- **FR-004**: Audit trail rows that are not security severity older than **3 years** MUST be deleted. Younger non-security rows MUST remain. Deletion-trail rows written by this job are non-security and follow this same 3-year rule; they MUST NOT persist indefinitely and MUST NOT live in a separate unbounded store. Cites PRD §6 non-security events.
- **FR-005**: Trail rows still inside their window MUST NOT be updated or deleted. Corrections remain new rows. This job is the exception only **after** the window. Cites PRD §6 System 1; Constitution II.
- **FR-006**: Product analytics events older than **24 months** MUST be deleted. Newer analytics events MUST remain. Analytics events MUST NOT be taken from, or written into, the audit trail. Cites PRD §6 product analytics vs audit.
- **FR-007**: Deactivated accounts that have been inactive for **3 years** MUST be anonymized. In scope for that person: personal fields on the **account row** (names, email and email lookup, title, DOC affiliation, denial notes, MFA material); leftover **directory listing** and **shown-field** copies; leftover **sign-in sessions**; leftover **password-reset tokens**. The account identifier MUST remain. Resource **uploader**, event **host**, and announcement **creator** identifiers MUST NOT be rewritten. Active accounts and deactivated accounts inside the window MUST NOT be anonymized. Cites PRD §6 deactivated user records.
- **FR-014**: Replacement values for encrypted personal fields MUST be written through the **same personal-data encryption path** the rest of the product uses. The job MUST NOT bypass that path with a raw database write of plaintext, empty bytes, or ciphertext produced elsewhere. Cites Constitution II.
- **FR-008**: Password-reset tokens that are past 60 minutes or already used MUST be deleted. Unused tokens still inside 60 minutes MUST remain usable. Cites PRD §6 / §5.1.
- **FR-009**: Invitation tokens that are already expired or revoked MUST be deleted so they cannot be redeemed and leftover invitee personal details on those rows do not remain. Pending invitations still inside 14 days MUST NOT be deleted by this pass. Cites PRD §6 / §5.2.
- **FR-010**: Each deletion class that removes one or more rows MUST append exactly one new **non-security** trail row in the same unit of work, recording the class and the **row count deleted**. That row MUST NOT contain names, emails, tokens, DOC affiliation, or copies of deleted payloads. It MUST NOT use security severity (that would keep it 7 years and recreate unbounded accumulation under a different label). Cites PRD §6 “all retention deletions are themselves recorded in the audit log with row counts”; Constitution II.
- **FR-011**: A class that deletes zero rows MUST NOT write a deletion trail row. Cites avoidable log noise; counts still match reality.
- **FR-012**: The pass MAY introduce the minimum new trail action name(s) needed to record retention deletions. It MUST NOT reuse a misleading existing member or staff action. It MUST NOT add product-analytics event names. Cites PRD §6 event list gap; FR-017 of analytics slice does not apply here.
- **FR-013**: Tests MUST prove each class with a frozen clock (over-limit vs in-window fixtures) and MUST prove the deletion trail count. Unauthorized product roles MUST have no new web path that runs the job. Cites Constitution IV.
- **FR-015**: `authMode: "retention"` MUST have exactly one production call site: `runRetentionJob`. The standalone RLS test file MUST assert this by scanning `lib/`, `app/`, and `scripts/` for the literal `authMode: "retention"` (same single-call-site check used for other privileged modes such as `resource_download` and `invite_lookup`). Test files may set `app.auth_mode` via raw SQL for policy proofs; they MUST NOT add a second product `withRls({ authMode: "retention" })`. Cites Constitution I.

### Key Entities

- **Audit trail row**: Append-only evidence until its class window ends (security vs other). After the window, the weekly pass may remove it.
- **Retention deletion record**: A new **non-security** trail row created by the pass, stating which class was cleaned and how many rows, without PII. It ages out after **3 years** like any other non-security trail row.
- **Product analytics event**: Engagement insight already emitted for program measurement; separate store and 24-month lifetime.
- **Deactivated account**: Status deactivated; after 3 years of inactivity, personal-detail copies are anonymized (account row, leftover directory copies, leftover sessions and reset tokens) but the identifier and content-attribution identifiers remain.
- **Short-lived token**: Password-reset (60 minutes) or invitation (14 days). This pass removes only tokens that are already unusable.

### Constraints (mandated by PRD §6 and Constitution; not open design)

Do not offer the pass as a page or public endpoint. Do not wire production timers in this slice. Do not treat analytics events as evidence or evidence rows as analytics. Do not hard-delete deactivated accounts here. Do not put PII on the deletion trail row. Do not shrink or widen the PRD windows except under the Q7 assumption below. Do not rewrite resource uploader, event host, or announcement creator identifiers during anonymization. Do not write personal-field replacements except through the product’s existing personal-data encryption path. Do not set `authMode: "retention"` anywhere except `runRetentionJob`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a frozen-clock fixture, 100% of security trail rows older than 7 years are gone and 100% of younger security rows remain unchanged.
- **SC-002**: In the same style of fixture, 100% of non-security trail rows older than 3 years are gone — including deletion-trail rows this job wrote more than 3 years ago — and 100% of younger non-security rows remain unchanged. New deletion-trail rows written in that run remain.
- **SC-003**: For every class that deleted at least one row, exactly one new trail row exists whose count equals the number deleted; 0 remaining in-window trail rows are modified; a second run deletes 0 extra rows from those fixtures and adds 0 extra deletion trail rows.
- **SC-004**: 100% of deactivated accounts past 3 years of inactivity have unrecoverable personal details, 0 directory listing or shown-field copies, and 0 leftover sessions or password-reset tokens; 100% of their resource/event/announcement attribution identifiers still name the same account id; 100% of active or recently deactivated accounts still have recoverable original details; historical trail identifiers for anonymized accounts still resolve to the same account id.
- **SC-005**: 100% of expired/used password-reset tokens and expired/revoked invitation tokens in the fixture are gone and unusable; 100% of still-valid reset tokens and still-pending in-window invitations remain.
- **SC-006**: 100% of product analytics events older than 24 months in the fixture are gone; 100% of younger analytics events remain; 0 in-window audit trail rows are removed as a side effect of the analytics class.
- **SC-007**: The pass can be completed in tests without opening a web page and without waiting calendar years (frozen clock).
- **SC-008**: 0 new staff or member product addresses exist that run the job; unauthorized roles cannot trigger it through the application.

## Assumptions

- **PRD §11 Q7**: Retention periods in this spec are the PRD v1.1 defaults (7 years / 3 years / 24 months / anonymize after 3 years inactive). Final values may change if DOC or funder contracts require it. Recorded in `docs/decisions/assumptions-log.md`. **Unconfirmed by Amend.**
- **Security vs other trail rows**: “Security events” means trail rows marked security severity; “non-security” means info or warning. PRD’s trail schema uses that severity field.
- **Inactivity for anonymization**: Clock starts at deactivation; any successful sign-in after that resets it. If the person never signed in, three years after deactivation is enough.
- **Anonymize, don’t delete**: Account identifier, role snapshot history, trail foreign keys, and content-attribution identifiers (resource uploader, event host, announcement creator) stay. Recoverable personal-detail copies do not: account personal fields, leftover directory listing and shown-field rows, leftover sessions, leftover password-reset tokens (Clarifications 2026-08-18).
- **Encryption path**: Anonymization replacements for encrypted personal fields use the same helpers as the rest of the product. A raw SQL bypass is out of bounds.
- **Invitation cleanup vs expiry sweep**: Marking pending invites expired (and mailing) stays the existing expiry sweep. This job only **deletes already unusable** invite tokens (expired or revoked).
- **Empty class**: No deletion trail row when the count is 0.
- **Analytics store**: Product analytics events live in the engagement analytics system, not on the audit trail. This slice still must age them out at 24 months and record the count on the trail.
- **New trail action**: PRD’s published event list has no retention-deletion name; this slice adds the minimum name(s) to satisfy FR-010. Those rows are non-security and follow the 3-year window (Clarifications 2026-08-18).
- **No immortal deletion ledger**: Recording that a deletion happened is not a reason to keep that record forever. Counts are reconstructable only while the deletion-trail row itself is still inside 3 years.
- **No UI in this slice**: Operators run the job the same way they run the invitation expiry sweep locally; production cadence is operations.
- **Sessions**: Platform-wide 30-day session-cookie expiry remains the authentication slice. Sessions belonging to an account **being anonymized** are removed with that person’s personal-detail copies (Clarifications 2026-08-18).
- **No silent extra §11 guesses**: Data residency (Q13) and self-service deletion (not a §11 item, PRD §8) are not opened here.
