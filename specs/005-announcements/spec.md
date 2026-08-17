# Feature Specification: Announcement Banners

**Feature Branch**: `005-announcements`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Start slice 005-announcements (PRD §5.4). Cover: admin-created banners with activation/expiry windows, up to two CTAs, visibility targeting (reuse the resources visibility pattern), per-user dismissal, max two active banners shown at once, impression/CTA-click tracking."

**Cites**: PRD v1.1 §2 (Banner CTA CTR KPI; announcement impression and announcement CTA click events), §3 (roles and permission matrix: view announcements / create-manage announcements), §4 (authorization model, visibility set), §5.4 (announcement banners with CTAs), §6 System 1 (content–announcements audit events) and System 2 (product analytics; no PII), Appendix A.2 (Announcement, AnnouncementDismissal), Appendix B.2–B.3 (`/app` banners, `/admin/announcements`); Constitution v1.0.0 Principles I, II, IV, V; `002-auth-rbac` visibility contract and three-layer authorization; `004-resource-library` as the first product content table on that same visibility set.

## Scope

This slice delivers **time-limited, role-targeted announcement banners** at the top of the authenticated member experience, plus the admin workflow to create and manage them. Super Admins and Admins write a headline, body, optional call-to-action buttons, a visibility set, and an activation/expiry window. Members see a banner only when it is in its window, their roles intersect its visibility set, they have not dismissed it, and it is among the two most recently activated banners they are allowed to see. Dismissal is remembered per person. Showing a banner and clicking a CTA are counted for the Banner CTA CTR KPI without sending personal information to analytics.

This is the **second product content table** on Constitution Principle I’s visibility set (`all_authenticated` | `pathways` | `lead`). It MUST reuse the same visibility contract and three-layer authorization already proven in `002-auth-rbac` and used by `004-resource-library`. It MUST NOT introduce a second authorization model, a new visibility vocabulary, or a client-supplied role.

**In scope**

- Admin/Super Admin create, edit, and withdraw announcements: headline, body (bold, links, inline emphasis only), up to two CTAs (label + destination), visibility set, activation time, expiry time, and whether the banner may be dismissed
- Member banners at the top of authenticated member pages (`/app` and other `/app/*` pages except the pending holding page), filtered by signed-session roles intersecting visibility, current time inside the window, and that member’s dismissals
- At most two banners shown to any one member at a time; if more are eligible after that member’s dismissals, **the most recently activated two** are shown (activation time, not created time); dismissing one can free a slot for the next eligible banner
- Per-user, per-announcement dismissal stored in the product; a dismissed banner does not return for that user
- Admin queue at `/admin/announcements` (create, edit, detail) showing scheduled, active, and expired items, with filter and sort
- Audit events `announcement_created`, `announcement_edited`, `announcement_deleted`
- Product analytics events for unique impressions and unique CTA clicks (opaque user id and role labels only)
- Permission-matrix proofs for **View announcements** and **Create / manage announcements** in PRD §3, run both through the application and with the application bypassed

**Out of scope**

- Sign-in, sessions, MFA, `requireRole`, the audit writer, the visibility contract, and the analytics tracker itself (already `002-auth-rbac` / `004-resource-library`; this slice **consumes** them)
- Registration, invitation, and approval (`003-registration-invitation-approval`)
- Resource library, events, directory, forum, WordPress feed, and other dashboard cards besides banners
- Banners on public pages, sign-in, or `/app/pending`
- Member-authored announcements
- A status-flip background job; eligibility is decided when the page is shown from the window, visibility, and dismissals (scheduled / active / expired on the admin queue are derived the same way)
- Admin analytics dashboards and CTR leaderboards (this slice writes the events those views will use later)
- Email or push when a banner activates
- A/B testing, scheduling more than one window per announcement, or targeting named individuals
- A new authorization mechanism, a second visibility vocabulary, or client-supplied roles
- Production host provisioning

## Clarifications

### Session 2026-08-17

- Q: When more than two banners are eligible for a user (after dismissals), which two are shown? → A: The most recently activated two (PRD §5.4). Ranking uses each announcement’s activation time, not created time.

## User Scenarios & Testing *(mandatory)*

Primary actors: **Pathways member**, **LEAD member**, **Admin**, **Super Admin**. **Moderator** is a secondary actor (may see every banner for awareness, and MUST be refused create/edit/delete). **Pending members**, **invited token holders**, and **signed-out visitors** must be refused without leaking whether a banner exists.

### User Story 1 - Admin publishes a time-windowed, role-targeted banner (Priority: P1)

An Admin or Super Admin opens the announcement workspace, writes a headline and body, optionally adds one or two call-to-action buttons, chooses who should see it (everyone signed in, Pathways only, LEAD only, or a combination), and sets when it should start and end. If the start time is already in the past, it is live as soon as they save. Members in the intended audience can see it during the window; members outside that audience cannot.

**Why this priority**: Nothing else in this slice exists until an authorized admin can publish a complete, visibility-tagged, time-bounded banner (PRD §5.4).

**Independent Test**: As Admin (MFA-satisfied), create one shared banner and one Pathways-only banner, both with windows that include now. Confirm both appear in the admin list as active. Confirm a Pathways member sees both (subject to the two-banner cap), a LEAD member sees only the shared one, and a Moderator cannot open the create form.

**Acceptance Scenarios**:

1. **Given** an MFA-satisfied Admin or Super Admin, **When** they submit a complete announcement (headline, body, at least one visibility value, activation time, expiry after activation), **Then** one announcement exists, `announcement_created` is written, and members in the visibility set see it while now is inside the window.
2. **Given** a required field missing, expiry at or before activation, more than two CTAs, a CTA with a label but no destination (or the reverse), or a secondary CTA without a primary, **When** they submit, **Then** no announcement is created and the reason is shown to that admin.
3. **Given** an activation time already in the past and an expiry still in the future, **When** they save, **Then** the banner is treated as live immediately for eligible members.
4. **Given** a banner visible to both Pathways and LEAD, **When** members of either program open the member app, **Then** they see that single banner (not two copies).
5. **Given** a Moderator, Pathways member, LEAD member, or pending user, **When** they request the admin create or edit screens, **Then** they are denied and no announcement management data is returned.

---

### User Story 2 - Members see at most two eligible banners (Priority: P1)

A signed-in Pathways or LEAD member opening the member app sees banners at the top of the page. They only see banners that are currently in their window, that their roles allow, and that they have not dismissed. If more than two qualify, they see **the most recently activated two** (by activation time, not created time). Banners do not appear for pending users or on public pages.

**Why this priority**: The member-facing value of this slice is a small, role-correct set of banners — not an unbounded stack (PRD §5.4 cap of two).

**Independent Test**: Create three in-window banners visible to Pathways, with staggered activation times. Confirm a Pathways member sees only the most recently activated two; a LEAD member sees none of the Pathways-only set; a pending user sees none.

**Acceptance Scenarios**:

1. **Given** a Pathways member and an in-window Pathways-only banner, **When** they open an authenticated member page (not the pending holding page), **Then** that banner is shown at the top.
2. **Given** a LEAD member and a Pathways-only in-window banner, **When** they open the member app, **Then** that banner is not shown.
3. **Given** three in-window banners the member is allowed to see, **When** they load the page, **Then** only the most recently activated two are shown.
4. **Given** now is before activation or after expiry, **When** any member loads the page, **Then** that banner is not shown.
5. **Given** a pending member, invited token holder, or signed-out visitor, **When** they request member banners, **Then** they receive none and existence is not leaked.

---

### User Story 3 - Member dismisses a banner for themselves (Priority: P1)

A member who is allowed to dismiss a banner closes it. It does not come back for them on later visits. Other members still see it. If a third eligible banner was waiting behind the two-banner cap, dismissing one of the shown banners can reveal the next most recently activated eligible banner for that member.

**Why this priority**: Dismissal is required by PRD §5.4 and is what keeps the top of the member app usable after someone has read a notice.

**Independent Test**: Pathways member dismisses one of two shown banners. Reload: that banner is gone for them; a third eligible banner may appear in its place; a second Pathways member who has not dismissed still sees the original banner.

**Acceptance Scenarios**:

1. **Given** a member viewing a dismissible banner, **When** they dismiss it, **Then** it is not shown to them again, including after they sign out and back in on another device.
2. **Given** member A has dismissed a banner, **When** member B (same visibility) loads the member app, **Then** member B still sees it if it remains eligible for them.
3. **Given** a banner marked not dismissible, **When** the member views it, **Then** there is no dismiss control and the banner stays until it expires or an admin withdraws it.
4. **Given** three eligible dismissible banners and two shown, **When** the member dismisses one of the shown two, **Then** at most two remain shown, drawn from remaining eligible banners as the most recently activated two.
5. **Given** a member who cannot see a banner (wrong role, outside window, or already withdrawn), **When** they attempt to dismiss it, **Then** the attempt fails without revealing whether the banner exists.

---

### User Story 4 - Admin manages scheduled, active, and expired banners (Priority: P2)

Admins open `/admin/announcements` and see banners grouped or filterable as scheduled (not yet started), active (in window), and expired (past expiry), with sort. They can edit a scheduled or live banner (including visibility before or after activation); the new visibility and window apply from then on. They can withdraw a banner so members stop seeing it immediately.

**Why this priority**: Program staff need a queue, not only a create form; editing and stopping a live notice is how they correct mistakes (PRD §5.4 queue + edge cases).

**Independent Test**: Create one future, one live, and one expired banner. Filter the queue to each state. Edit the scheduled banner’s visibility before it starts; confirm members see the new set after activation. Withdraw the live one; confirm members no longer see it.

**Acceptance Scenarios**:

1. **Given** MFA-satisfied Admin or Super Admin, **When** they open the announcement queue, **Then** they can list, filter, and sort scheduled, active, and expired banners.
2. **Given** a scheduled banner, **When** they change its visibility before activation, **Then** members see the new visibility set once the window starts (PRD §5.4).
3. **Given** an active banner, **When** they edit headline, body, CTAs, visibility, or window, **Then** `announcement_edited` is written and members see the updated banner on the next load (still subject to window, visibility, dismissal, and the cap of two).
4. **Given** an active or scheduled banner, **When** they withdraw it, **Then** members stop seeing it immediately, `announcement_deleted` is written, and member-facing withholding does not announce that it was withdrawn.
5. **Given** a Moderator or program member, **When** they request the admin queue, **Then** they are denied.

---

### User Story 5 - Impressions and CTA clicks are counted without personal data (Priority: P2)

When an eligible banner is actually shown to a member, the product records that they saw it (at most once per member per announcement). When they use a CTA, the product records the click (which button, without the destination text or the banner copy) at most once per member per announcement for the unique CTR. Names, emails, and banner text never leave the application in those events.

**Why this priority**: Banner CTA CTR (≥ 8% unique clicks ÷ unique impressions) is a launch KPI (PRD §2); it is unusable if events are missing or if they contain PII (Constitution II).

**Independent Test**: Show a banner to a Pathways member twice (two page loads); confirm one impression. Click the primary CTA twice; confirm one unique click for that announcement. Confirm the recorded events contain only an opaque member id and role labels — not name, email, headline, or body.

**Acceptance Scenarios**:

1. **Given** a banner is shown to a member among the capped two, **When** that first show happens, **Then** one impression is recorded for that member and announcement.
2. **Given** the same member loads member pages again, **When** the same banner is shown, **Then** unique impression count for that pair does not increase.
3. **Given** a member clicks a CTA on a banner they can see, **When** the click is recorded, **Then** unique CTA click for that member and announcement is counted once, including which button (first or second) as a non-personal label.
4. **Given** a banner not shown (wrong role, dismissed, outside window, or not in the two), **When** the member uses the app, **Then** no impression is recorded for it.
5. **Given** any impression or CTA-click event, **When** the payload is inspected, **Then** it has no name, email, DOC affiliation, headline, body, or CTA label/URL.

---

### Edge Cases

- Activation already in the past on create: live immediately if expiry is still in the future.
- Expiry at or before activation: rejected; no record.
- Scheduled banner whose visibility changes before activation: members see the new set when it starts.
- More than two eligible banners: only the most recently activated two are shown (activation time, not created time); others wait until a shown one expires, is withdrawn, or is dismissed (if dismissible).
- Two non-dismissible banners plus a third eligible: the member keeps the most recently activated two (they cannot dismiss to free a slot) until a window ends or an admin withdraws one.
- Dismissing does not affect other members.
- Repeat dismiss of an already dismissed banner: success with no extra effect (idempotent).
- Guessed announcement id outside the user’s visibility, withdrawn, or outside the window: same withholding as unknown; no cohort or existence leak.
- Client-supplied role header, query parameter, or body field: ignored.
- Body or headline attempting unrestricted formatting or raw markup: only bold, links, and inline emphasis are kept; everything else is not rendered as active markup.
- CTA destination that is not a safe web address or in-app member location: rejected at save.
- Zero CTAs: allowed. One CTA: allowed (as the first button). Two CTAs: allowed. A second button without a first: rejected.
- Administrative user with program role `none` on member pages: sees `all_authenticated` banners only; on admin pages, Admin/Super Admin manage every visibility.
- Moderator can view banners of every visibility on member pages; create/edit/withdraw still denied.
- Pending, denied, deactivated, invited, and signed-out: 0 banners.
- Empty queue or no eligible banners: empty state, not an error.
- Clock at the exact activation instant: treat as in-window (inclusive start). Clock at the exact expiry instant: treat as in-window (inclusive end), matching PRD “now is inside the closed window.”
- Analytics events carry opaque user ids and role labels only — never names, emails, or announcement copy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Super Admin and Admin MUST be able to create an announcement with required headline, body, visibility set, activation time, and expiry time, plus optional first and second CTAs (each a label + destination) and whether the banner is dismissible (default: yes). Cites PRD §5.4, Appendix A.2.
- **FR-002**: Body MUST allow only bold, links, and inline emphasis. Raw markup from the author MUST NEVER be written through as active HTML. Cites Constitution Principle II.
- **FR-003**: At most two CTAs. A CTA MUST have both a label and a destination, or neither. The second CTA MUST NOT be set unless the first is set. Destinations MUST be safe web addresses (`http`/`https`) or in-app member locations; unsafe schemes MUST be rejected.
- **FR-004**: Expiry MUST be after activation. Validation MUST reject expiry at or before activation. An activation already in the past MUST be accepted and treated as live immediately when expiry is still in the future.
- **FR-005**: Visibility MUST be a set of one or more of `all_authenticated`, `pathways`, and `lead`. A user sees the announcement if and only if any of their roles intersects that set **and** the other eligibility rules in this spec hold. Announcements visible to multiple audiences MUST be stored once. Cites PRD §4, Constitution Principle I. This MUST be the same vocabulary and intersection rule as `004-resource-library`.
- **FR-006**: This slice MUST reuse the `002-auth-rbac` authorization mechanism. It MUST NOT invent a parallel permission model, a new visibility vocabulary, or trust a role claim from the client.
- **FR-007 (layer 1)**: Member banner surfaces (`/app` and other authenticated member pages that show banners) MUST require a session. Admin announcement routes (`/admin/announcements`, `/admin/announcements/new`, `/admin/announcements/[id]`) MUST require a session and MFA-satisfied. Unauthenticated requests MUST NOT return announcement data.
- **FR-008 (layer 2)**: Every server path that returns or mutates announcement data MUST call `requireRole` (or the equivalent named helper from `002-auth-rbac`) **before** returning data. Role MUST come from the signed session. The helper MUST NOT be mocked in tests whose purpose is to verify the role check.
- **FR-009 (layer 3)**: The announcement table MUST carry the same visibility set as Constitution Principle I, with queries including role-based filters **and** native database row-level security enabled. That policy layer MUST NOT depend on a managed-database vendor. Withdrawn rows MUST be withheld from members at this layer as well. Dismissal rows MUST be readable/writable only for the signed-in user (plus Admin/Super Admin as needed for support), never for another member via the client.
- **FR-010**: Create, edit, and withdraw MUST be allowed only for Super Admin and Admin. Moderator, Pathways, LEAD, pending, and invited MUST be denied those mutations. Cites PRD §3.
- **FR-011**: View announcements MUST be allowed for Super Admin, Admin, and Moderator (all visibilities), role-targeted for Pathways and LEAD, and denied for pending and invited. Cites PRD §3.
- **FR-012**: A member-facing banner MUST be shown only when all of the following are true: the announcement is not withdrawn; now is inside `[activates_at, expires_at]`; the viewer’s roles intersect visibility; the viewer has not dismissed it; it is among the most recently activated two eligible banners for that viewer.
- **FR-013**: No more than two banners MUST be visible to any one user at a time. Eligibility for the cap MUST exclude banners that user has dismissed. If more remain eligible, **the most recently activated two** MUST be shown. “Most recently activated” means the latest activation time, not created time. Cites PRD §5.4.
- **FR-014**: Dismissal MUST be per user per announcement, persisted, and MUST NOT resurface that banner for that user. Dismissal MUST NOT hide the banner from other users. Non-dismissible banners MUST NOT offer a dismiss control. Cites PRD §5.4, Appendix A.2.
- **FR-015**: Admins MUST have a queue at `/admin/announcements` that shows scheduled, active, and expired banners (derived from now vs the window, not a separate job), with filter and sort. Cites PRD §5.4, Appendix B.3.
- **FR-016**: Admins MUST be able to edit an announcement in place (including visibility before and after activation). Changes apply on the next member load. The action MUST write `announcement_edited`.
- **FR-017**: Withdraw MUST hide the announcement from all member views immediately while retaining the record for the admin queue and audit period. Member-facing withholding MUST NOT announce that the item was withdrawn. The action MUST write `announcement_deleted`.
- **FR-018**: This slice MUST emit `announcement_created`, `announcement_edited`, and `announcement_deleted` through the existing append-only audit writer. Rows remain append-only. Cites PRD §6.
- **FR-019**: When a banner is actually shown to a member, the product MUST record `announcement impression` at most once per member per announcement. When a member uses a CTA on a banner they can see, the product MUST record `announcement CTA click` (which button: first or second) with unique CTR counted at most once per member per announcement. Banners not shown MUST NOT record an impression. Cites PRD §2, §5.4, §6.
- **FR-020**: Product analytics for this slice MUST receive opaque user ids and role labels only. Names, emails, DOC affiliation, titles, headline, body, CTA labels, and CTA destinations MUST NEVER appear. Cites Constitution Principle II, PRD §2 / §6.
- **FR-021**: CSRF protection MUST apply to every state-changing announcement request (create, edit, withdraw, dismiss, CTA-click recording). Cites PRD §8.
- **FR-022**: Every row of the PRD §3 permission matrix for **View announcements** and **Create / manage announcements** MUST be asserted. The matrix MUST run twice: through the application, and directly against the database with the application bypassed. Other capabilities remain fail-closed if not implemented here. Cites Constitution Principle IV.
- **FR-023**: Every route handler delivered in this slice MUST have a test that it rejects an unauthorized role, not only that it accepts an authorized one.
- **FR-024**: Secrets MUST NEVER appear in Git, recoverable test fixtures, or log lines. Hostnames and connection strings MUST come from environment variables only. Cites Constitution Principle III.
- **FR-025**: Banner chrome MUST meet WCAG 2.1 AA for this surface: dismiss and CTA targets at least 44×44 CSS pixels, a name for every control, and no motion that ignores reduced-motion. Cites Constitution Principle V.

### Key Entities

- **Announcement**: A single admin-authored banner (headline, body, optional first and second CTAs, visibility set, activation time, expiry time, whether it may be dismissed, author, created time, optional withdraw time). Identity is stable across edits.
- **Visibility set**: `all_authenticated` | `pathways` | `lead` (one or more). Same contract as `002-auth-rbac` and `004-resource-library`.
- **Announcement dismissal**: The fact that a given user dismissed a given announcement, and when. One per user per announcement.
- **Audit log**: Existing append-only store; this slice adds the three announcement content events.
- **Analytics events**: Existing opaque tracker; this slice adds unique impression and unique CTA-click events for banners that were actually shown.

### Constraints (mandated by PRD §5.4 / §3 / §4 / §6 and Constitution; not open design)

This slice does not re-open authentication, authorization, or hosting choices. Plan and tasks MUST reuse `002-auth-rbac` sessions, `requireRole` from the signed session, native database row-level security on the announcement table (and dismissal records), and the append-only audit writer. Impression and CTA-click recording MUST go through the existing analytics helper from `004-resource-library` (opaque ids and role labels only; extra/PII fields rejected). Do not introduce a new authorization library, a managed-database proprietary policy layer, client-supplied roles, or a second visibility vocabulary. Eligibility MUST be evaluated when the member page is shown; do not add a required background worker to flip a stored “active” flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An MFA-satisfied Admin can create a complete in-window banner (headline, body, visibility, window, optional CTAs) in under 3 minutes.
- **SC-002**: 100% of unauthorized attempts in the two PRD §3 announcement capabilities are denied on both the application run and the application-bypassed database run. Zero cross-role announcement leaks in those runs.
- **SC-003**: A Pathways member is shown 0 LEAD-only banners; a LEAD member is shown 0 Pathways-only banners; both are shown shared (`all_authenticated`) banners that are otherwise eligible.
- **SC-004**: Pending members, invited token holders, and signed-out visitors receive 0 announcement records from member surfaces.
- **SC-005**: When three or more banners are eligible for a member, 100% of page loads show at most two, and those two are **the most recently activated two** among remaining eligible (not dismissed, in window, visibility intersects, not withdrawn). Ranking uses activation time, not created time.
- **SC-006**: After a member dismisses a dismissible banner, 100% of later loads for that member omit it; 100% of loads for another member who has not dismissed still include it if it remains eligible.
- **SC-007**: 100% of creates with expiry at or before activation are rejected; 100% of creates with activation already past and expiry in the future are live immediately for eligible members; 100% of banners outside the window are omitted from member view.
- **SC-008**: After withdraw, 100% of member views omit that banner; the admin queue still shows it as withdrawn.
- **SC-009**: 100% of impression and CTA-click payloads in the test set contain 0 names, emails, DOC affiliations, headlines, bodies, CTA labels, or destinations; unique impression and unique CTA click do not increase on repeat show or repeat click for the same member and announcement.
- **SC-010**: Moderators succeed at 0 create, edit, or withdraw attempts; they can still see banners of every visibility on member pages.
- **SC-011**: An Admin can find a known scheduled, active, and expired banner in the queue (filter/sort) in under 1 minute.
- **SC-012**: A developer following local steps can create, schedule, show by role, enforce the cap of two, dismiss, click a CTA, edit visibility, expire, and withdraw against a local database with no production host.

## Assumptions

Named assumptions below are **recorded**, not silent. Constitution v1.0.0 requires this for PRD §11 dependencies.

### PRD §11 dependencies

| Question | Relevance to this slice | Decision in this spec |
| --- | --- | --- |
| **Q3** Network name list | Visibility tokens and who sees role-specific banners | **Proceed** on **Pathways and LEAD only**, same as `002-auth-rbac` and `004-resource-library`. Visibility remains `all_authenticated \| pathways \| lead`. **Revisit** if Amend adds networks. |
| **Q6** Email provider | No announcement-activation emails are specified | **Not required.** This slice does not send mail. |
| **Q7** Retention / funder commitments | Withdrawn announcements and dismissal rows vs audit period | **Proceed** on PRD defaults (7y security / 3y other) as **policy**. A retention-sweep job is **out of scope**; withdraw MUST NOT erase the announcement row or audit history. |
| **Q8** FERPA / HIPAA / state regime | Banner copy may mention program moments | **Proceed** on the PRD preliminary read (neither FERPA nor HIPAA directly). Still: no PII to analytics, no existence leaks across roles. |
| **Q13** Data residency | Where records live in production | **Not a hosting decision in this slice.** Local/dev uses the existing local database. |
| **Q17–Q20** Operational ownership | Who runs production | **Not a dependency for local proof.** |

### Other assumptions

- **Authorization reuse**: Same visibility intersection and three layers as `004-resource-library`. Moderators see both program visibilities on member pages (PRD §3 View announcements is allowed, not role-limited for Moderator) and are denied management.
- **Where banners appear**: Top of authenticated member pages (`/app` and other `/app/*` except `/app/pending`). Not on public pages, sign-in, or admin pages. An Admin with a program role who opens `/app` sees banners as a member.
- **Inclusive window**: A banner is eligible at the activation instant and at the expiry instant (closed interval), matching PRD “now is inside the window.”
- **Cap after dismiss**: The two-banner cap is applied **after** excluding that user’s dismissals, so dismissing a shown banner can reveal the next eligible one. Among remaining eligible banners, the shown pair is always **the most recently activated two** (PRD §5.4), ranked by activation time rather than created time.
- **Dismissible default**: New banners are dismissible unless the admin turns that off. Non-dismissible is for notices that must remain until expiry or withdraw (Appendix A.2 field).
- **No restore UI**: Withdraw has no member-facing undo. Admins still see withdrawn items. Re-publishing is a new announcement if needed.
- **No activation worker**: Scheduled / active / expired are computed from the clock when listing or rendering. PRD’s mention of a background job for activation/expiration is not required for correctness in this slice.
- **CTA destinations**: `http`/`https` URLs and in-app member paths only. No `javascript:` or other unsafe schemes. Open-in-same-app vs new tab is a later UI choice; destinations must be visible as the button label, not dumped as raw URLs in analytics.
- **Copy limits** (PRD unspecified): headline at most 120 characters; body at most 1,000 characters; each CTA label at most 40 characters. These keep the top of the page usable at 360px.
- **Unique KPI events**: Unique impression = first time that member was shown that announcement. Unique CTA click = first time that member clicked any CTA on that announcement. Repeat shows and repeat clicks do not inflate those unique counts. Which button (first vs second) may still be stored as a non-personal property on the click event.
- **Analytics helper**: Reuse the existing tracker; if it no-ops when no analytics key is configured, tests still assert payload shape and uniqueness locally.
- English-only UI; local session/MFA conventions from `002-auth-rbac` still apply.
