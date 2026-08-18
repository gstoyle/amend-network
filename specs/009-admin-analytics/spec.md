# Feature Specification: Admin Analytics Dashboard

**Feature Branch**: `009-admin-analytics`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Start slice 009-admin-analytics (PRD §6 admin dashboard requirements). This slice is READ-ONLY aggregation over data already being written by prior slices (002-008). It must not add new writes, new tracked events, or modify any existing table, audit_log, or PostHog event schema. It only queries and displays what already exists. Cover: top-line KPI cards (total approved members, MAM, pending registrations, content counts), invitation→registration→approval→first-login→30-day-retention funnel segmentable by network, engagement leaderboards (top 10 downloaded resources, top 10 viewed forum threads, most-attended events — forum excluded since slice 008-forum is not built), moderation workload view (deferred, no forum yet), audit log viewer (paginated, filterable by actor/action/date/severity, export CSV Super-Admin-only and itself audit-logged)."

**Cites**: PRD v1.1 §2 (launch KPIs: invitation → activation, 30-day return, MAM, resource engagement, event RSVP), §3 (View analytics dashboard; View audit log — Admin last 90 days, Super Admin full history and export), §6 (System 1 audit trail, System 2 product analytics as already instrumented, Admin dashboard requirements), Appendix B.3 (`/admin`, `/admin/analytics`, `/admin/audit-log`); Constitution v1.0.0 Principles I, II, IV, V; slices `002-auth-rbac` through `007-member-directory` as the exclusive data sources. **PRD §10** optional deferral of funnels and leaderboards is **not** taken for this slice except forum-dependent views. **PRD §11 Q3** — proceeds on Pathways and LEAD only (`docs/decisions/assumptions-log.md`).

## Scope

This slice delivers a **read-only staff analytics and audit-review surface**. Super Admin and Admin (MFA satisfied) can see whether the network is growing, who is coming back, which resources and events members actually use, and can inspect the existing audit trail. It **does not** record new kinds of activity. It **does not** change member-facing behavior. It **does not** alter stored records, the audit-trail shape, or the product-analytics event list already emitted by prior slices.

Numbers on this dashboard are **aggregations of data already written** by authentication, registration, resources, events, announcements, and directory slices. Forum thread views, forum leaderboards, and moderation workload (open flags, time-to-resolution) are **deferred** until a forum slice exists.

The only allowed writes are the two audit actions the trail already accepts for this surface: viewing the audit log, and exporting it. No other write. No new action names. No new or changed storage structures.

**In scope**

- Top-line cards at `/admin/analytics` (and the same four cards on `/admin` for Super Admin and Admin): total approved members, monthly active members (MAM), pending registrations, content counts (live resources, uncancelled events, current announcements)
- Conversion funnel: invitation → registration → approval → first login → 30-day retention, filterable by network (all, Pathways to Change, LEAD)
- Engagement leaderboards for program planning, not member ranking: top 10 most-downloaded live resources; most-attended uncancelled events (Yes responses). Forum thread leaderboard omitted
- Audit log viewer at `/admin/audit-log`: paginated; filterable by actor, action, date range, and severity; Admin sees the last 90 days; Super Admin sees full history
- Super-Admin-only download of the current filtered audit view as a CSV file; that download is itself recorded on the audit trail using the existing export action
- Permission-matrix proofs for **View analytics dashboard** and **View audit log** in PRD §3, run both through the application and with the application bypassed

**Out of scope**

- New activity tracking, new audit action names, new product-analytics events, or any change to existing trail or analytics event lists
- Changing, correcting, or deleting operational records or audit rows (the trail remains append-only)
- Forum thread views, top viewed threads, open/resolved flags, average time-to-resolution, or any other forum-dependent moderation workload (forum is not built)
- Banner CTR, time-to-approve as a dedicated card, availability, or other §2 KPIs not listed in §6 admin dashboard requirements
- Product-analytics configuration, session replay, or a second analytics product
- Weekly retention-sweep jobs, retention-period changes, or hard-delete / data-subject flows
- System configuration, user approval, or content publishing (already prior slices)
- Moderator, Pathways, LEAD, pending, invited, or signed-out access to analytics or the audit viewer
- Production host provisioning

## User Scenarios & Testing *(mandatory)*

Primary actors: **Super Admin**, **Admin**. **Moderator**, **Pathways member**, **LEAD member**, **pending member**, and **signed-out visitors** must be refused on analytics and audit-review screens without leaking counts.

### User Story 1 - Read top-line health at a glance (Priority: P1)

An MFA-satisfied Super Admin or Admin opens `/admin/analytics` (or `/admin`) and immediately sees four current figures: how many approved members exist, how many of those were active this calendar month (MAM), how many registrations are waiting, and how much live content is on the platform (resources not withdrawn, events not cancelled, announcements not withdrawn). MAM is also split by Pathways vs LEAD. The numbers match what staff would count by hand from the same underlying records. Opening this screen does not create member activity and does not add new kinds of audit events.

**Why this priority**: PRD §6 top-line cards are the operational daily view; without them staff have no single place to see launch KPIs.

**Independent Test**: Seed known approved members (some who signed in this calendar month, some who did not), pending registrations, live and withdrawn resources, cancelled and live events, and current announcements. Confirm the four cards match those counts. Confirm a Moderator and a Pathways member cannot see the numbers.

**Acceptance Scenarios**:

1. **Given** an MFA-satisfied Super Admin or Admin, **When** they open `/admin/analytics` or `/admin`, **Then** they see total approved members, MAM for the current calendar month, pending registration count, and content counts for live resources, uncancelled events, and current announcements.
2. **Given** MAM, **When** they read the card, **Then** it counts distinct approved Pathways and LEAD members with at least one successful sign-in in the current calendar month, shows the total, and shows the Pathways vs LEAD split. Staff-only accounts with no program role are excluded.
3. **Given** withdrawn resources, cancelled events, or withdrawn announcements, **When** content counts are shown, **Then** those items are omitted.
4. **Given** a Moderator, Pathways member, LEAD member, pending user, or signed-out visitor, **When** they request `/admin/analytics`, **Then** they are denied and no KPI numbers are returned.
5. **Given** an Admin or Super Admin viewing these cards, **When** the visit completes, **Then** no new operational record is created and no new kind of audit action is written (existing audit-view rows occur only if they also open the audit viewer).

---

### User Story 2 - Inspect the join-to-return funnel by network (Priority: P2)

Staff open the funnel on `/admin/analytics` and see how many people sit at each stage: invitation issued, registration completed, approval, first successful sign-in after approval, and return within 30 days of that first sign-in. They can view all networks together or filter to Pathways to Change or LEAD. Stage counts only move people forward; they never invent activity that was not already recorded.

**Why this priority**: PRD §6 funnels (and §2 invitation → activation / 30-day return) are how program leads judge whether onboarding is working. Useful after KPI cards exist.

**Independent Test**: Seed one Pathways invite completed and signed in twice over 31 days, one LEAD self-registration still pending, and one approved member who never signed in. Filter by each network and confirm stage counts.

**Acceptance Scenarios**:

1. **Given** an MFA-satisfied Super Admin or Admin, **When** they open the funnel with no network filter, **Then** they see five stages in order: invitation, registration, approval, first login, 30-day retention, each with a count.
2. **Given** that funnel, **When** they choose Pathways to Change or LEAD, **Then** every stage recounts only people in that network and other-network people disappear from the counts.
3. **Given** an invited person who completed their invite (already approved at completion), **When** the funnel is calculated, **Then** they count at invitation, registration, and approval; first login and retention follow later sign-ins.
4. **Given** a self-registrant, **When** they have submitted but not been approved, **Then** they count at registration only (not invitation unless they were also invited; not approval).
5. **Given** an approved member whose first successful sign-in was fewer than 30 days ago, **When** retention is shown, **Then** they are omitted from the 30-day-retention denominator (not yet eligible), so recent joins do not drag the rate down.
6. **Given** an approved member whose first successful sign-in was at least 30 days ago, **When** they signed in at least once more during the 30 days after that first sign-in, **Then** they count as retained; if they did not, they count at first login but not at retention.
7. **Given** a Moderator or member, **When** they request the funnel, **Then** they are denied.

---

### User Story 3 - See which resources and events members actually use (Priority: P2)

Staff open engagement leaderboards on `/admin/analytics` to plan content: the ten live resources with the most downloads, and uncancelled events ranked by Yes responses (attendance proxy). Rows are content titles and counts, not a ranking of members. Forum thread views are absent, with a clear empty/deferred note rather than a broken list.

**Why this priority**: PRD §6 leaderboards exist for program planning. They depend only on resource and event data already stored.

**Independent Test**: Seed 12 live resources with mixed download totals including some with 1–2 downloads, one withdrawn with a high count, and several events with Yes counts 1, 2, 3+, plus one cancelled. Confirm at most 10 live resources with ≥3 downloads, 1–2 omitted entirely (not listed), withdrawn omitted, events capped at 10 with ≥3 Yes, cancelled omitted, no thread list.

**Acceptance Scenarios**:

1. **Given** live resources with download totals, **When** staff open the resource leaderboard, **Then** they see up to ten live resources with **at least 3** downloads, ordered by download count, with title and count, and withdrawn resources are omitted even if they were heavily downloaded.
2. **Given** uncancelled events with Yes responses, **When** staff open the event leaderboard, **Then** they see up to ten events with **at least 3** Yes responses, ordered by Yes count; cancelled events and events with 1 or 2 Yes are omitted; the list is for planning (no member names).
3. **Given** no forum, **When** staff look for a thread leaderboard, **Then** it is not shown as a populated ranking (deferred explicitly; no placeholder fake rows).
4. **Given** zero qualifying rows (no live resource with ≥3 downloads, or no uncancelled event with ≥3 Yes), **When** staff open a leaderboard, **Then** they see an empty state, not an error, and no below-threshold title is listed.
5. **Given** a Moderator or member, **When** they request leaderboards, **Then** they are denied.

---

### User Story 4 - Review the audit trail with filters (Priority: P1)

An MFA-satisfied Super Admin or Admin opens `/admin/audit-log`, already present as a simple list, and can page through it and narrow it by who acted, what action, date range, and severity. Super Admin sees the entire history. Admin sees only the last 90 days (rows older than that never appear, including when filters are applied). Opening a page of the viewer records that the log was viewed, using the existing view action, in the same unit of work as the read. Rows cannot be edited.

**Why this priority**: PRD §3 / §6 require a reviewable trail for internal review and funder reporting. The current list is not filterable enough to use.

**Independent Test**: Seed mixed actions, actors, dates (including 91 days ago), and severities. As Admin, confirm 91-day-old rows never appear. As Super Admin, confirm they do. Apply each filter and confirm the subset. Confirm a view record is appended and no existing row changes.

**Acceptance Scenarios**:

1. **Given** an MFA-satisfied Super Admin, **When** they open `/admin/audit-log`, **Then** they can page through the full trail and filter by actor, action, date range, and severity.
2. **Given** an MFA-satisfied Admin, **When** they use the same viewer, **Then** they can page and filter, but every visible row is from the last 90 days; older rows stay hidden even if a date filter requests them.
3. **Given** combined filters, **When** they apply actor + action + date range + severity, **Then** only rows matching all selected filters (within that role’s window) are listed.
4. **Given** a successful viewer load, **When** the read commits, **Then** exactly one existing “audit log viewed” trail row is added for that visit and no prior row is changed.
5. **Given** a Moderator, Pathways member, LEAD member, pending user, or signed-out visitor, **When** they request `/admin/audit-log`, **Then** they are denied and no trail rows are returned.
6. **Given** any staff user, **When** they attempt to change or remove an existing trail row through the product, **Then** that path does not exist.

---

### User Story 5 - Export the filtered audit trail (Super Admin only) (Priority: P3)

A Super Admin downloads the **currently filtered** audit view as a CSV file for offline review or funder reporting. An Admin does not see the control and cannot obtain the file. The download is recorded on the trail with the existing export action in the same unit of work as producing the file. The file contains the same columns as the on-screen table (evidence fields already stored: time, actor identifier, role snapshot, action, related record type and id, severity, and network address / client string as already kept on the trail). It does not add decrypted names, emails, or DOC affiliation.

**Why this priority**: PRD §3 and §6 restrict export to Super Admin and require the export itself to be logged. Operational without it; required for reporting.

**Independent Test**: As Super Admin, filter the viewer and export; confirm the CSV matches the filter and an export trail row exists. As Admin, confirm no export control and a direct export request is denied with no file and no export trail row (a denied attempt may still be visible as a generic refusal, not as a successful export).

**Acceptance Scenarios**:

1. **Given** an MFA-satisfied Super Admin with filters applied, **When** they export, **Then** they receive a CSV of those filtered rows (full history, not a 90-day cap) and one existing export action is written; no prior row is changed.
2. **Given** an MFA-satisfied Admin, **When** they view `/admin/audit-log`, **Then** there is no export control, and requesting export is denied with no file.
3. **Given** a Moderator or member, **When** they request export, **Then** they are denied.
4. **Given** a Super Admin export, **When** the file is inspected, **Then** it does not include decrypted names, emails, or DOC affiliation; identifiers match what the trail already stores.

---

### Edge Cases

- Zero approved members, zero pending, or zero live content: cards show zero, not an error.
- MAM in a month with no sign-ins: MAM is zero; total approved members may still be non-zero.
- Staff-only accounts (administrative role, no Pathways/LEAD program role): excluded from approved-member and MAM cards.
- Invitees who complete registration are already approved: they occupy invitation, registration, and approval together; they still need a later sign-in for first login.
- Expired or revoked invitations: count at invitation only.
- Denied self-registrations: count at registration, not approval.
- Deactivated members: remain in historical funnel stages they already passed; they do not count in current approved-member or MAM cards.
- Admin date filter that starts more than 90 days ago: still no rows older than 90 days.
- Empty filter result: empty list, not an error; export of an empty Super Admin filter produces an empty CSV (headers only) and still records the export.
- Withdrawn resource with high lifetime downloads: omitted from the resource leaderboard.
- Cancelled event with many Yes responses: omitted from the event leaderboard.
- Concurrent Admin and Super Admin viewing analytics: both see the **same** aggregated KPI, funnel, and leaderboard numbers (the 90-day rule applies only to raw audit rows, not to these aggregates).
- Opening analytics does not write product-analytics events or new audit action types.
- Client-supplied role claiming Super Admin: ignored; signed session wins.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The analytics dashboard at `/admin/analytics` MUST be available only to MFA-satisfied Super Admin and Admin. Moderator, program members, pending, invited, and signed-out visitors MUST be denied and MUST receive no aggregated numbers. Cites PRD §3 View analytics dashboard, Constitution I.
- **FR-002**: `/admin` MUST show the same four top-line cards as `/admin/analytics` for Super Admin and Admin. Moderator MAY keep using `/admin` for other staff tasks they already have but MUST NOT see those cards or any analytics aggregates.
- **FR-003**: Top-line cards MUST include: (1) total currently approved Pathways and LEAD members, (2) MAM for the current calendar month, (3) current pending registration count, (4) content counts for live resources, uncancelled events, and current announcements.
- **FR-004**: MAM MUST equal distinct approved Pathways and LEAD members with at least one successful sign-in in the current calendar month, and MUST be shown as a total plus a Pathways vs LEAD split. Cites PRD §2 MAM definition.
- **FR-005**: Content counts MUST omit withdrawn resources, cancelled events, and withdrawn announcements.
- **FR-006**: `/admin/analytics` MUST show the five-stage funnel invitation → registration → approval → first login → 30-day retention, with counts at each stage, segmentable by network (all networks, Pathways to Change, LEAD). Cites PRD §6 funnels; Q3 network list.
- **FR-007**: Funnel stage membership MUST be derived only from already-recorded join and sign-in activity (invitations issued; registrations submitted or invites completed; approvals, including invite completion as approval; first successful sign-in after approval; a later successful sign-in within 30 days of that first sign-in). The slice MUST NOT invent or backfill activity.
- **FR-008**: The 30-day-retention stage MUST include in its denominator only people whose first successful sign-in was at least 30 days ago, so members still inside the window are not treated as drop-offs.
- **FR-009**: `/admin/analytics` MUST show a top-10 live-resource download leaderboard (title and download count) and a top-10 uncancelled-event attendance leaderboard (title and current Yes count). Rows MUST be content, not people. A resource or event whose count is **less than 3** MUST be omitted entirely (not shown with a suppressed or zeroed count). Cites PRD §6 engagement leaderboards; k=3 is a named assumption ([research.md](./research.md) §6a) — PRD does not specify a floor.
- **FR-010**: Forum thread leaderboards and moderation workload (open flags, resolved flags, average time-to-resolution) MUST NOT ship in this slice. The analytics screen MUST NOT imply those figures exist.
- **FR-011**: Super Admin and Admin MUST see identical KPI, funnel, and leaderboard aggregates. The Admin 90-day restriction MUST apply only to individual audit-trail rows, not to these aggregates. Cites PRD §3 (analytics vs audit as separate capabilities).
- **FR-012**: `/admin/audit-log` MUST remain Super Admin and Admin only (MFA satisfied). It MUST be paginated and filterable by actor, action, date range, and severity. Cites PRD §6 audit log viewer.
- **FR-013**: Admin audit reads MUST return only rows from the last 90 days, including when filters would otherwise match older rows. Super Admin MUST see the full history. Cites PRD §3.
- **FR-014**: Loading a page of the audit viewer MUST append one existing view action on the trail in the same unit of work as the read. Existing rows MUST NOT be updated or deleted. Cites PRD §6, Constitution II.
- **FR-015**: CSV export of the current filtered audit view MUST be available only to MFA-satisfied Super Admin. Admin and all other roles MUST be denied. Cites PRD §3 / §6.
- **FR-016**: A successful export MUST append one existing export action on the trail in the same unit of work as producing the file. The file MUST use the same evidence columns the viewer shows from stored trail fields and MUST NOT add decrypted names, emails, or DOC affiliation. Cites Constitution II (PII leaves the boundary only on an audited Super Admin export; this export stays at trail identifiers).
- **FR-017**: This slice MUST NOT add new audit action names, new product-analytics events, or any change to existing trail or analytics event lists. It MUST NOT add or alter storage structures used by prior slices.
- **FR-018**: This slice MUST NOT write operational data (users, invitations, resources, events, announcements, sessions, directory). Allowed writes are solely the existing audit view and export actions in FR-014 and FR-016.
- **FR-019**: Every analytics and audit-review path MUST enforce three layers: session required on admin routes; server-side role check from the signed session before returning data; database policies that still withhold unauthorized rows if the application check is skipped. Client-supplied roles MUST be ignored. Cites Constitution I.
- **FR-020**: Permission-matrix rows **View analytics dashboard** and **View audit log** MUST be asserted through the application and again with the application bypassed. Every new handler MUST have a test that an unauthorized role is rejected. Cites Constitution IV, PRD §3.
- **FR-021**: Analytics and audit screens MUST use the existing design tokens, meet WCAG 2.1 AA on those pages, keep interactive targets at least 44×44 CSS pixels, and allow horizontal scroll only inside the data table containers. Cites Constitution V.
- **FR-022**: Aggregates and trail views MUST NOT send names, emails, DOC affiliation, titles, or free-text profile fields to product analytics. Cites Constitution II.

### Key Entities

- **Approved member snapshot**: Count of people currently approved in Pathways or LEAD (not pending, denied, or deactivated; not staff-only accounts).
- **Monthly active member (MAM)**: An approved Pathways or LEAD member with at least one successful sign-in in the current calendar month.
- **Pending registration**: A submitted self-registration still waiting for an approve/deny decision.
- **Content inventory**: Live resources, uncancelled events, current announcements — counts of what members can still use, not historical totals.
- **Join funnel**: Ordered stages from invitation through 30-day return, attributed by network.
- **Resource engagement rank**: Live resources ordered by download totals already stored.
- **Event attendance rank**: Uncancelled events ordered by current Yes responses (the platform’s attendance proxy; there is no check-in).
- **Audit trail row**: Append-only evidence already stored (time, actor, role snapshot, action, related record, severity). This slice reads it, filters it, and (Super Admin) exports it; it does not change the row shape.
- **Network**: Pathways to Change and LEAD (Q3 assumption). Funnel segments use this list only.

### Constraints (mandated by PRD §6 / §3 and Constitution; not open design)

This slice does not re-open authorization, audit, or analytics-instrumentation choices. Plan and tasks MUST query existing records and existing trail/analytics events. Do not add a warehouse, a new event stream, or a second audit store. Do not treat product analytics as evidence or the audit trail as a place to fix numbers. Do not implement forum or flag queues here.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized Admin or Super Admin can read the four top-line numbers within 10 seconds of opening `/admin/analytics` or `/admin` (local, warmed session).
- **SC-002**: In a fixture with known members, sign-ins, pending rows, and content, 100% of the four top-line cards match a hand count of those fixtures (including zeros and the MAM role split).
- **SC-003**: 100% of unauthorized roles (Moderator, Pathways, LEAD, pending, signed-out) receive no analytics aggregates and no audit rows on both the application run and the application-bypassed run.
- **SC-004**: Given a documented fixture covering invitees, self-registrants, pending, denied, never-signed-in, retained, and not-yet-eligible members, funnel stage counts match the fixture at 100% for “all networks” and for each network filter.
- **SC-005**: Resource leaderboard shows at most 10 live resources, omits 100% of withdrawn resources and 100% of resources with fewer than 3 downloads, and orders by download count; event leaderboard shows at most 10 uncancelled events, omits 100% of cancelled events and 100% of events with fewer than 3 Yes responses, and orders by Yes count; 0 forum-thread ranks are shown; 0 below-threshold titles appear.
- **SC-006**: Admin audit views contain 0 rows older than 90 days; Super Admin views of the same fixture include those older rows. Combined filters return only rows matching all selected criteria.
- **SC-007**: Super Admin can produce a CSV of the current filter in under 1 minute for a fixture of at least 200 trail rows; Admin export attempts succeed 0 times.
- **SC-008**: Each successful audit-viewer page load adds exactly one view trail row; each successful Super Admin export adds exactly one export trail row; 0 existing trail rows are modified; 0 new action names appear.
- **SC-009**: 100% of authorized staff in a first-use walkthrough can name the four cards and apply one funnel network filter without training beyond on-screen labels (qualitative: 5 of 5 in UAT, or all available staff if fewer).
- **SC-010**: Analytics and audit-review pages introduced or changed in this slice pass the project accessibility scan with 0 serious or critical findings, and data tables remain usable at 360px via containerised horizontal scroll only.

## Assumptions

- **Read-only slice**: Prior slices already write the sign-ins, invitations, registrations, approvals, downloads, RSVPs, announcement lifecycle, and audit view/export action names this dashboard reads. This slice does not wait on new instrumentation.
- **PRD §10**: The optional “KPI cards only at launch; funnels and leaderboards later” reduction is **declined** for resources and events. Forum leaderboards and moderation workload remain deferred because forum is not built (current `008` is design tokens, not forum).
- **PRD §11 Q3**: Funnel networks are Pathways to Change and LEAD only, per `docs/decisions/assumptions-log.md`. Additional networks would add segments, not a new permission model.
- **MAM population**: “Members” means approved Pathways and LEAD accounts. Administrative-only accounts with no program role are excluded from approved-member and MAM cards.
- **MAM instrumentation**: A successful sign-in already recorded on the audit trail (or an equivalent existing session record from the same event) is the activity that counts. No new “page view” is required.
- **Attendance proxy**: “Most-attended events” means current Yes responses on uncancelled events. The product has no check-in.
- **Resource rank window**: Download rank uses the lifetime download total already kept on each live resource (PRD attaches “past 30 days” only to forum threads, which are out of scope).
- **Leaderboard k=3**: Named assumption, not PRD text. `topResources` / `topEvents` omit rows with count < 3 entirely (not a suppressed number). Events are capped at 10 after that filter, matching resources. KPI/funnel integers are not k-filtered. Recorded in [research.md](./research.md) §6a and `docs/decisions/assumptions-log.md`. **Unconfirmed by Amend.**
- **Invite vs self-reg funnel**: Completing an invitation counts as registration and approval at that moment (`003`). Self-registrants split those stages.
- **Retention eligibility**: People whose first successful sign-in was fewer than 30 days ago are omitted from the retention denominator.
- **Identical aggregates**: Admin and Super Admin see the same KPI/funnel/leaderboard numbers so program staff are not looking at a 90-day-clipped picture. The 90-day rule stays on the raw trail viewer only.
- **Export columns**: Super Admin CSV matches on-screen evidence fields already stored on the trail; it does not decrypt profile PII into the file.
- **Calendar month**: MAM uses the same timezone already used to display event times, so “this month” matches what staff see elsewhere.
- **Existing viewer**: Pagination and the view-action write already exist on `/admin/audit-log`; this slice extends that screen with filters and Super Admin export rather than replacing the trail.
- **No silent §11 guesses**: DOC affiliation (Q2), retention-job periods (Q7), and data residency (Q13) are not opened here; this slice does not change stored PII or retention jobs.
