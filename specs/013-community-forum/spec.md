# Feature Specification: Community Forum

**Feature Branch**: `013-community-forum`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "ok can we build the forum now?"

**Cites**: PRD v1.1 §2 (forum participation KPI; forum thread viewed / post created / post flagged events), §3 (View forum / Post to forum / Moderate forum; Moderator scope), §4 (visibility set), §5.7 (community forum), §6 System 1 (forum audit events) and System 2 (no PII in analytics), §11 (launch with flagging + hide + delete; per-thread subscriptions; defer digest, @-mentions, posting suspension, bulk hide), Appendix A.3, Appendix B (`/app/forum`, `/app/forum/c/[slug]`, `/app/forum/t/[id]`, `/community-guidelines`, `/admin/forum`, `/admin/forum/flags`); Constitution Principles I–V.

## Scope

This slice delivers the **role-gated discussion board**: categories with the existing visibility set, two-level threads (thread + flat posts, no nested replies), allowlisted markdown, rate limits, per-thread email subscriptions, member flagging, and staff hide / delete / lock / pin. It reuses the three-layer authorization already proven on resources, announcements, and events.

**In scope**

- Seeded categories (Pathways welcome, LEAD welcome, all-members general) plus Admin/Super Admin category create/edit
- Members start threads and reply in categories their roles can see
- Allowlisted markdown (bold, italic, links); no raw HTML; no image uploads in this slice
- 15-minute author edit window; later edits require staff
- Rate limits: 1 new thread per minute, 5 posts per minute, 30 posts per hour; staff exempt
- Per-thread subscribe / unsubscribe, including one-click unsubscribe from the notification email
- Flag a post; staff queue at `/admin/forum/flags`
- Staff hide (member-invisible, retained), delete (soft, member-invisible), lock thread, pin thread
- Published community guidelines at `/community-guidelines`
- Forum in primary navigation; recent activity on the member home
- Audit events already reserved: `post_created`, `post_edited`, `post_flagged`, `post_hidden`, `post_deleted`, `thread_locked`, `thread_pinned`
- Analytics events with opaque ids only: thread viewed, post created, post flagged
- Permission-matrix and RLS proofs for View / Post / Moderate forum

**Out of scope**

- Posting suspension / ban (`user_forum_suspended` stays unused)
- Bulk hide, @-mentions, weekly digest
- Nested replies, polls, reactions, private messages
- Image or file attachments (markdown links only)
- WordPress blog feed (home reserved column stays reserved)
- A new authorization model or visibility vocabulary

## Assumptions

- Launch moderation is flag + hide + delete + lock + pin, per PRD §11, not the fuller §5.7 suspension surface.
- Per-thread email stays; digest and @-mentions wait.
- Image uploads wait; posts are text markdown like announcements.
- Community guidelines ship as an Amend-operated page; Q5 (who signs the policy) remains open — the page states operational rules the product enforces and that program staff own escalation.
- Five primary destinations (Home, Resources, Events, Forum, Directory) fit the bottom bar; overflow is still not required.
- Author display uses the member’s decrypted given and family name for readers who can already see the post; empty names render as “Member”. Posting is not directory opt-in.
- Staff (Admin, Super Admin, Moderator) see every category for moderation; category create/edit is Admin and Super Admin only.

## User Scenarios & Testing *(mandatory)*

Primary actors: **Pathways member**, **LEAD member**, **Moderator**, **Admin**, **Super Admin**. Pending members and signed-out visitors are refused without leaking whether a category or thread exists.

### User Story 1 - Browse role-gated categories and threads (Priority: P1)

A signed-in member opens Forum and sees only categories whose visibility intersects their roles. Opening a category lists its threads. Opening a thread shows a flat list of posts. A Pathways-only category is invisible to a LEAD member.

**Why this priority**: Nothing else in the forum exists until members can find the rooms they are allowed to enter (PRD §5.7).

**Independent Test**: Seed Pathways-only, LEAD-only, and all-members categories. Confirm each programme sees the shared category plus their own, never the other programme’s, and that pending users see none.

**Acceptance Scenarios**:

1. **Given** an active Pathways member, **When** they open `/app/forum`, **Then** they see all-members and Pathways categories and do not see LEAD-only categories.
2. **Given** an active LEAD member, **When** they open `/app/forum`, **Then** they see all-members and LEAD categories and do not see Pathways-only categories.
3. **Given** a pending member or signed-out visitor, **When** they request forum pages, **Then** they are refused and existence is not leaked.
4. **Given** a Moderator, Admin, or Super Admin, **When** they open Forum, **Then** they can see every category so they can moderate.

---

### User Story 2 - Start a thread and reply (Priority: P1)

A member starts a thread in a category they can see (title + first post) and later replies. Posts use allowlisted markdown. The author may edit a post for 15 minutes. Hidden and deleted posts do not appear to members.

**Why this priority**: This is the participation the forum participation KPI counts (PRD §2, §5.7).

**Independent Test**: Pathways member creates a thread in the shared category; LEAD member can read and reply; Pathways member cannot create in a LEAD-only category.

**Acceptance Scenarios**:

1. **Given** a member who can see a category, **When** they submit a valid title and body, **Then** a thread and first post exist, `post_created` is audited, and they are subscribed to the thread.
2. **Given** a member who can see a thread that is not locked, **When** they submit a valid reply, **Then** a post is added and `post_created` is audited.
3. **Given** HTML or a disallowed construct in the body, **When** they submit, **Then** no post is stored.
4. **Given** the author of a post younger than 15 minutes, **When** they edit, **Then** the body updates and `post_edited` is audited.
5. **Given** a post older than 15 minutes, **When** the author tries to edit, **Then** the edit is refused unless the actor is staff.

---

### User Story 3 - Rate limits (Priority: P1)

A member cannot flood the board. Limits are 1 thread per minute, 5 posts per minute, and 30 posts per hour. Staff are exempt.

**Why this priority**: PRD §5.7 rate limits are a safety control, not polish.

**Independent Test**: Exceed each cap as a Pathways member; confirm refusal. Confirm a Moderator is not capped.

**Acceptance Scenarios**:

1. **Given** a member who created a thread in the last minute, **When** they start another, **Then** it is refused with a later-try message.
2. **Given** a member who has posted 5 times in the last minute, **When** they reply again, **Then** it is refused.
3. **Given** staff, **When** they post faster than the caps, **Then** the posts succeed.

---

### User Story 4 - Flag, hide, delete, lock, pin (Priority: P1)

A member flags a post with a reason. Staff see flags at `/admin/forum/flags` and can hide or delete the post, lock or pin the thread. Hidden/deleted posts leave member view. Locking blocks new replies.

**Why this priority**: The board cannot launch without a moderation path (PRD §5.7, §11).

**Independent Test**: Member flags a post; Moderator hides it; other members no longer see it; locking the thread rejects a new reply.

**Acceptance Scenarios**:

1. **Given** a member who can see a post, **When** they flag it with a reason, **Then** an open flag exists and `post_flagged` is audited.
2. **Given** MFA-satisfied staff, **When** they hide a post, **Then** members stop seeing it, the row remains, and `post_hidden` is audited.
3. **Given** staff, **When** they delete a post, **Then** members stop seeing it and `post_deleted` is audited.
4. **Given** a locked thread, **When** a member replies, **Then** the reply is refused.
5. **Given** a pinned thread, **When** members list the category, **Then** it appears before unpinned threads.
6. **Given** a programme member, **When** they request `/admin/forum/flags`, **Then** they are denied.

---

### User Story 5 - Subscribe and community guidelines (Priority: P2)

A member can subscribe to a thread and receive an email when someone else posts, with a one-click unsubscribe. Guidelines are published at `/community-guidelines` and linked from compose.

**Why this priority**: Subscriptions are MVP per PRD §11; guidelines are a launch dependency.

**Independent Test**: Subscribe, have another member reply, confirm an email (or json transport file) with an unsubscribe link that stops further mail.

**Acceptance Scenarios**:

1. **Given** a subscriber who is not the new author, **When** a reply is stored, **Then** they receive a notification that does not include other members’ emails in the body beyond addressing them.
2. **Given** the unsubscribe link, **When** they use it, **Then** they are unsubscribed.
3. **Given** any visitor, **When** they open `/community-guidelines`, **Then** they see the published rules.

---

### Edge Cases

- Unknown thread id: same refusal as unauthorized, no existence leak.
- Flagging the same post twice by the same member: one open flag; repeat is a no-op or a clear already-flagged message.
- Hidden thread: omitted from member lists; staff can still open it from the flag queue.
- Category visibility change: members see the new set on the next load.
- Author of a hidden post: treated as a member; they do not see it either.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Categories MUST carry visibility `all_authenticated | pathways | lead` (same vocabulary as other content).
- **FR-002**: Members MUST see a category iff their session tokens intersect its visibility, except staff who see all categories for moderation.
- **FR-003**: Threads belong to one category; posts belong to one thread; replies MUST be flat.
- **FR-004**: Bodies MUST be markdown with the announcement allowlist (bold, italic, http(s) or `/app/` links). HTML MUST be rejected. Image uploads are out of scope.
- **FR-005**: Members MAY start threads and reply in categories they can see, subject to lock and rate limits.
- **FR-006**: Author edit window MUST be 15 minutes; afterwards only staff may change the body.
- **FR-007**: Rate limits MUST be 1 thread/min, 5 posts/min, 30 posts/hour per member; staff exempt.
- **FR-008**: Members MAY flag a post; staff MUST have a flag queue with post, reporter id, and reason (no extra PII in analytics).
- **FR-009**: Staff MAY hide, delete (soft), lock, and pin. Hide and delete remove member visibility and retain rows.
- **FR-010**: Members MAY subscribe per thread; new posts email subscribers except the author; unsubscribe is one-click from the email.
- **FR-011**: Every create, edit, flag, hide, delete, lock, and pin MUST write an append-only audit row in the same transaction.
- **FR-012**: Analytics MUST record thread viewed, post created, and post flagged with opaque ids and role labels only — never names, emails, titles, or bodies.
- **FR-013**: `/community-guidelines` MUST publish the operational rules.
- **FR-014**: Forum MUST appear in primary navigation between Events and Directory.
- **FR-015**: Member home MUST show recent visible forum activity.
- **FR-016**: Route middleware, `requireRole`, and PostgreSQL RLS MUST all apply. Role MUST come from the signed session.

### Key Entities

- **ForumCategory**: name, slug, description, visibility, sort order
- **ForumThread**: category, author, title, pinned, locked, last posted at, hidden/deleted timestamps
- **ForumPost**: thread, author, markdown body, edited at, hidden/deleted timestamps
- **ForumFlag**: post, reporter, reason, status (open / kept / hidden / deleted), resolver
- **ForumSubscription**: user, thread
- **ForumPostThrottle**: per-user windows for thread and post caps

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Pathways member can open Forum, start a thread in a shared category, and post a reply in under 3 minutes.
- **SC-002**: A LEAD member never sees a Pathways-only thread in the UI or via a guessed URL.
- **SC-003**: Exceeding a rate cap is refused without storing a row.
- **SC-004**: After a hide, members no longer see the post on reload; the row remains for staff.
- **SC-005**: A subscriber receives a notification for someone else’s reply and can unsubscribe from that email.
- **SC-006**: Permission-matrix tests for view / post / moderate forum match PRD §3 through the app and with the app bypassed.
- **SC-007**: Analytics fixtures for forum events contain no name, email, title, or body.
