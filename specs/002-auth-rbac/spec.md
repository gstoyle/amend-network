# Feature Specification: Authentication & Role-Based Access Control

**Feature Branch**: `002-auth-rbac`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Build authentication and role-based access control for the Amend Member Network, per docs/prd/amend-prd.md section 5.1 and the authorization model in section 4. Include the audit log schema from section 6 System 1. Scope: session handling, requireRole, the three-layer authorization model including Postgres RLS policies, MFA enrollment for administrative roles, and the audit log writer. Assume PRD §11 Q3 (network list) is Pathways and LEAD only for now, flagged as an assumption to revisit. Target: runnable locally against a local Postgres instance, no DreamHost dependency. Out of scope: registration, invitation, or approval flows."

**Cites**: PRD v1.1 §3 (roles and permission matrix), §4 (authorization model), §5.1 (authentication & access control), §6 System 1 (audit log), §8 (MFA, CSRF, PII at rest), §11 Q3; Constitution v1.1.0 Principles I, II, and IV.

## Scope

This slice delivers **sign-in, sessions, role enforcement, administrative MFA, and the append-only audit writer**. A developer can run it locally against a local database. Later content features reuse the same visibility contract and audit writer; they are not built here.

**In scope**

- Email-and-password sign-in, sign-out, and server-side sessions that can be revoked
- Session rules from PRD §5.1 (sliding and absolute lifetime, browser-close expiry, no "remember me", prominent log out)
- Account lockout, password reset, and an active-sessions list with one-click revoke
- The three-layer authorization model (session required at the member and admin perimeters; server-side `requireRole` from the signed session; query filters **and** database row-level policies on every visibility-gated table)
- Program role vs administrative role as separate claims; visibility intersection (`all_authenticated` | `pathways` | `lead`)
- TOTP enrollment for administrative roles and an MFA-satisfied flag required for every admin-area route
- Audit log schema and append-only writer (PRD §6 System 1), emitting the authentication event set in this slice
- Permission-matrix proofs for capabilities this slice implements, run both through the application and with the application bypassed
- Seeded local accounts covering loginable roles and statuses (no registration UI)

**Out of scope**

- Registration, invitation, and approval workflows (PRD §5.2)
- Events, announcements, resource library, directory, forum, and WordPress feed (PRD §5.3–5.8)
- Product analytics, audit-log export UI, and the admin analytics dashboard (PRD §6 System 2 and admin dashboard)
- Magic-link sign-in and WordPress single sign-on
- Hard-delete / data-subject request flows
- DreamHost (or any production host) provisioning — that is `001-infra-foundation`

## User Scenarios & Testing *(mandatory)*

Primary actors: **member** (Pathways or LEAD), **administrative user** (Moderator, Admin, Super Admin), **pending member**, and **operator** running the slice locally. Unauthorized visitors are a secondary actor (they must be refused without leaking account state).

### User Story 1 - Sign in, stay signed in only as agreed, sign out (Priority: P1)

A member signs in with their email and password and reaches a member home appropriate to an approved account. The session is theirs alone: it cannot be read by other scripts in the page, it ends when they close the browser, it refreshes while they keep using the site (up to a 24-hour sliding window), and it never lasts more than 30 days without signing in again. There is no "remember me". Every authenticated screen has a clear log-out control. Signing out (or revoking that session) means that session cannot be reused.

**Why this priority**: Nothing else in the member platform is reachable without a trustworthy session (PRD §5.1).

**Independent Test**: Seed an approved member, sign in, confirm the home is shown, sign out, confirm member routes now send the visitor to sign-in. Confirm there is no remember-me control. Confirm closing the browser ends the session cookie.

**Acceptance Scenarios**:

1. **Given** an approved member with a known password, **When** they submit the correct email and password, **Then** they reach the member home and a server-side session exists for that user.
2. **Given** an authenticated member, **When** they choose log out, **Then** the server-side session is invalidated (not only the browser cookie) and a subsequent request to a member route is treated as signed-out.
3. **Given** the sign-in screen, **When** a visitor inspects it, **Then** there is no remember-me option.
4. **Given** an authenticated member, **When** they close the browser, **Then** the session cookie does not persist into a new browser session.
5. **Given** a session older than the 24-hour sliding window of inactivity, or older than 30 days from creation, **When** the member next uses the site, **Then** they must sign in again.

---

### User Story 2 - Three-layer authorization and role-visible content (Priority: P1)

A signed-in user only sees what their roles allow. Unauthenticated visitors never reach member or admin areas. Every data path checks the **signed session's** roles before returning data — the browser cannot supply a role. Content carries a visibility set; the user sees it only if any of their roles intersects that set. Administrative powers depend on the administrative role, not on which program they belong to. If the application check is skipped, the database still withholds rows the user is not allowed to see.

**Why this priority**: Unauthorized cross-role access is a launch-blocking incident (Constitution Principle I). This slice must prove the model before content features exist, using a representative visibility-gated record that later features reuse.

**Independent Test**: Seed Pathways, LEAD, and administrative users plus records visible to `pathways`, `lead`, and `all_authenticated`. Attempt each access both as a normal member request and as a direct database read under that user's database identity. Confirm allows and denials match PRD §3 for capabilities this slice implements; unimplemented capabilities deny.

**Acceptance Scenarios**:

1. **Given** no session, **When** a visitor requests a member or admin URL, **Then** they are sent to sign-in and no member or admin data is returned.
2. **Given** a Pathways member, **When** they request LEAD-only records, **Then** those records are absent (empty or not-found), not an error that names the other cohort.
3. **Given** a LEAD member, **When** they request Pathways-only records, **Then** the same withholding applies in reverse.
4. **Given** a record marked `all_authenticated`, **When** any approved, non-pending member or administrative user requests it, **Then** they can see it.
5. **Given** a user with an administrative role and a program role (or none), **When** they use member routes vs admin routes, **Then** member visibility follows program role (or admin-as-moderation rules in the matrix) and admin capabilities follow the administrative role alone.
6. **Given** the application role check is bypassed, **When** the same user reads through the database under their identity, **Then** row-level policies still hide rows their roles do not intersect.
7. **Given** a client-supplied role claim that does not match the signed session, **When** a data path runs, **Then** the signed session wins and the client claim is ignored.

---

### User Story 3 - Administrative MFA before any admin-area use (Priority: P1)

A user with an administrative role (Super Admin, Admin, or Moderator) must enroll a time-based authenticator on first administrative sign-in. Until enrollment is complete and the current session is marked MFA-satisfied, every admin-area route is refused. Completing a valid challenge sets the flag on that session. A member with no administrative role never sees an MFA enrollment demand for member routes.

**Why this priority**: PRD §5.1 and §8 require MFA for all administrative roles; Constitution Principle I requires `mfa_satisfied` on every admin route, not only an admin role claim.

**Independent Test**: Seed an Admin who has not enrolled MFA. Sign in with password. Confirm admin URLs are blocked and enrollment is required. Complete enrollment and a challenge. Confirm admin URLs then succeed. Repeat a challenge with a wrong code and confirm failure plus an audit row.

**Acceptance Scenarios**:

1. **Given** an administrative user with no authenticator enrolled, **When** they sign in with password, **Then** they cannot use any admin-area route until they enroll and pass a challenge.
2. **Given** enrollment in progress, **When** they submit a valid authenticator code, **Then** the session is MFA-satisfied and admin-area routes are allowed for that session.
3. **Given** an MFA-satisfied administrative session, **When** they open an admin-area route, **Then** access is granted according to their administrative role (not merely because MFA passed).
4. **Given** a Pathways or LEAD member with no administrative role, **When** they sign in, **Then** they are not asked to enroll MFA and admin-area routes remain denied.
5. **Given** a wrong authenticator code, **When** they submit it, **Then** admin-area access remains denied and a failed-challenge audit event is recorded.

---

### User Story 4 - Append-only audit trail for authentication events (Priority: P1)

Every security-relevant authentication action leaves an audit row at the moment it happens, in the same unit of work as the change. Rows are never edited. Corrections are additional rows. Anonymous failures (unknown email) may have no actor id. The writer uses the schema in PRD §6 System 1 and accepts the full enumerated action list so later slices do not change the log shape.

**Why this priority**: The audit log is evidence, not analytics (PRD §6). Auth events are the first producers; the writer must exist before other features emit lifecycle or content events.

**Independent Test**: Perform sign-in success, sign-in failure, lockout, logout, session revoke, MFA enroll, MFA failure, and password-reset request/complete. Confirm one new row per event with the required fields. Attempt to change an existing row and confirm that path does not exist.

**Acceptance Scenarios**:

1. **Given** a successful sign-in, **When** the session is created, **Then** a `login_success` row exists with actor, action, time, IP, user agent, and severity.
2. **Given** a failed sign-in, **When** the attempt completes, **Then** a `login_failure` row exists; if the email is unknown, actor id may be empty.
3. **Given** any auditable auth action in this slice, **When** it succeeds or fails, **Then** the audit row is written in the same transaction as the change (a rolled-back change leaves no orphan row, and a committed change is never missing a row).
4. **Given** an existing audit row, **When** any client or operator uses the product, **Then** there is no update or delete of that row within the retention window.
5. **Given** a non-administrative member, **When** they attempt to read audit rows, **Then** access is denied. Admins may read the last 90 days; Super Admins may read the full history (viewer chrome beyond that proof is out of scope).

---

### User Story 5 - Lockout without revealing whether an account exists (Priority: P2)

After 10 failed sign-in attempts against the same identifier within 15 minutes, further attempts are refused for 15 minutes. The visitor sees the same generic failure they would see for a wrong password or an unknown email. A security-severity audit row is written. The lockout itself does not confirm that the account exists.

**Why this priority**: Shared-device and hostile-network use makes brute force and account enumeration both in-scope risks (PRD §5.1, Constitution Principle II).

**Independent Test**: Submit 10 failures quickly, confirm the 11th is refused with the generic message, confirm a security audit row, confirm an unknown email never yields a different message.

**Acceptance Scenarios**:

1. **Given** 10 failed attempts on one identifier within 15 minutes, **When** an 11th attempt is made during the lock window, **Then** sign-in is refused for 15 minutes.
2. **Given** lockout, unknown email, denied account, or deactivated account, **When** the visitor reads the message, **Then** the wording is identical and does not name the reason.
3. **Given** a lockout, **When** audit is inspected, **Then** a `security` severity row exists.

---

### User Story 6 - Password reset that kills old sessions (Priority: P2)

A member who forgot their password requests a reset by email. They always see success. If the email is unknown, a distinct audit event is recorded for abuse monitoring. A known account receives a single-use token that expires in 60 minutes. Completing the reset sets a new password and invalidates **all** of that user's sessions.

**Why this priority**: PRD §5.1; required for local operation of seeded accounts without a registration flow.

**Independent Test**: Request reset for a known seed user, complete it within 60 minutes, confirm old sessions are dead. Request reset for an unknown email, confirm the user-visible success and a distinct audit event. Reuse a consumed or expired token and confirm failure.

**Acceptance Scenarios**:

1. **Given** a known active user, **When** they request a reset, **Then** they see success and can complete the reset with the one-time token within 60 minutes.
2. **Given** a completed reset, **When** any prior session for that user is presented, **Then** it is rejected.
3. **Given** an unknown email, **When** they request a reset, **Then** they see the same success as a known email, and audit records a distinct event.
4. **Given** an expired or already-used token, **When** they submit it, **Then** the password does not change.

---

### User Story 7 - Concurrent sessions and one-click revoke (Priority: P2)

A member may be signed in on more than one device. Their profile lists active sessions. They can revoke one session without signing out the others. Revoke writes an audit event and that session cannot be reused.

**Why this priority**: Shared and multi-device use is expected (PRD §5.1 compliance note).

**Independent Test**: Create two sessions for one user. Revoke one. Confirm the revoked session is refused and the other still works.

**Acceptance Scenarios**:

1. **Given** two active sessions for one user, **When** they open the active-sessions page, **Then** both are listed.
2. **Given** those sessions, **When** they revoke one, **Then** that session is invalid immediately and the other remains valid.
3. **Given** a revoke, **When** audit is inspected, **Then** a `session_revoked` row exists.

---

### User Story 8 - Pending holding page vs silent denial (Priority: P3)

A pending member may sign in and only reaches a holding page that their request is under review. They cannot use member content areas. Denied, deactivated, and nonexistent accounts cannot sign in, and the message does not distinguish among those states or from a wrong password.

**Why this priority**: PRD §3 allows pending login to a holding page; leaking status would enumerate accounts.

**Independent Test**: Seed pending, denied, and deactivated users. Sign in as each. Confirm pending sees only the holding page; the others see the generic failure.

**Acceptance Scenarios**:

1. **Given** a pending member and a correct password, **When** they sign in, **Then** they reach the holding page and cannot load other member content.
2. **Given** a denied or deactivated account and a correct password, **When** they attempt sign-in, **Then** they see the same generic failure as a wrong password or unknown email.
3. **Given** a pending session, **When** they request a member content URL, **Then** they are kept on (or returned to) the holding experience with no content records returned.

---

### Edge Cases

- Wrong password for a real account vs unknown email: same user-visible message; audit may differ.
- Pending vs denied vs deactivated vs nonexistent: pending may sign in to holding; the other three share the generic failure (see Assumptions for the PRD/constitution wording tension).
- Client sends a role header, query parameter, or body field: ignored; signed session is the only source.
- MFA-satisfied session after the administrative role is removed: admin-area routes deny even if the flag remains.
- MFA required again on a new session (new device or after revoke): a new challenge is required; enrollment is not repeated if already enrolled.
- Authenticator enrollment abandoned mid-flow: admin-area remains blocked; member routes follow program role and status.
- Session revoked on device A while device B is idle: B fails on next request.
- Password reset while other sessions exist: all sessions die on completion, including the one that requested the reset if it was signed in.
- Lockout window elapses: sign-in may be attempted again; failures start a new count.
- Audit writer called for a later-slice action (e.g. `resource_downloaded`): the writer accepts it; this slice does not emit those events.
- Local run with missing database settings: startup fails closed with a configuration error, not a hard-coded host.
- Closing the browser vs "log out": cookie is gone in both cases; only log out / revoke guarantees the server-side record is dead before expiry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST sign in with email as the identifier and a password of at least 12 characters with no composition rules. Cites PRD §5.1.
- **FR-002**: Stored passwords MUST be one-way hashed at the strength required by PRD §5.1 (see Constraints). Plaintext passwords MUST NEVER be stored or logged.
- **FR-003**: Sessions MUST be stored server-side and delivered only in cookies that are httpOnly, Secure, and SameSite=Lax. Lifetime MUST be 24 hours sliding and 30 days absolute. Cookies MUST expire on browser close. There MUST be no remember-me control. Cites PRD §5.1 compliance note.
- **FR-004**: Log out MUST invalidate the server-side session record, not only the cookie. A prominent log-out control MUST appear on every authenticated page.
- **FR-005**: Concurrent sessions MUST be allowed. The member MUST be able to list their active sessions and revoke one. Revoke MUST take effect immediately.
- **FR-006 (layer 1)**: Member-area routes (`/app/*`) and admin-area routes (`/admin/*`) MUST require a session. Unauthenticated requests MUST be sent to sign-in and MUST NOT return member or admin data.
- **FR-007 (layer 2)**: Every server path that returns data MUST call `requireRole` (or equivalent named helper) **before** returning data. Role MUST come from the signed session. Client-supplied role claims MUST be ignored. The helper MUST NOT be mocked in tests whose purpose is to verify the role check. Cites Constitution Principle I and IV.
- **FR-008 (layer 3)**: Visibility-gated tables MUST carry a visibility set of `all_authenticated | pathways | lead`, indexed for role-intersection lookups. Queries MUST include role-based filters **and** database row-level security MUST be enabled on those tables. That policy layer MUST be native to the database engine and MUST NOT depend on a managed-database vendor. Cites PRD §4, Constitution Principle I.
- **FR-009**: A user MUST see a visibility-gated entity if and only if any of their roles intersects its visibility set. Administrative capabilities MUST be gated on the administrative role independently of the program role.
- **FR-010**: A user MUST have exactly one program role (`pathways` | `lead` | `none`) and zero or one administrative role (`super_admin` | `admin` | `moderator` | `none`). Cites PRD §3, §4.
- **FR-011**: This slice MUST include a representative visibility-gated record type so FR-008 and FR-009 can be proven before resources, events, forum, and announcements exist. Later content tables MUST reuse this visibility contract.
- **FR-012**: Super Admin, Admin, and Moderator MUST enroll a TOTP authenticator at first administrative login. Every admin-area route MUST require the session's `mfa_satisfied` flag, not only an administrative role claim. Cites PRD §5.1, Constitution Principle I.
- **FR-013**: Ten failed sign-in attempts within 15 minutes MUST lock further attempts for 15 minutes and write a `security` severity audit row. Lockout MUST NOT reveal whether the account exists.
- **FR-014**: Password reset MUST use a 60-minute, single-use token. Completion MUST invalidate all sessions for that user. Requests for unknown emails MUST show the same success as known emails and MUST write a distinct audit event.
- **FR-015**: User-visible authentication errors MUST NEVER leak account existence, status, or reason. Denied, deactivated, and nonexistent accounts (and wrong passwords) MUST share one generic failure. Pending members are the exception in FR-016.
- **FR-016**: Pending members MUST be able to sign in to a holding page only. They MUST NOT see resources, directory, forum, events, or other member content. Cites PRD §3.
- **FR-017**: The audit log MUST match PRD §6 System 1 schema: id, created_at, actor_user_id (nullable), actor_role, action, entity_type, entity_id, target_user_id, ip, user_agent, metadata, severity (`info` | `warning` | `security`).
- **FR-018**: Audit rows MUST be append-only. Corrections MUST be new rows, never updates. Every auditable action in this slice MUST write synchronously in the same transaction as the change. The log MUST NOT use foreign keys to other entities. Cites Constitution Principle II, PRD §6, Appendix A.5.
- **FR-019**: This slice MUST emit the authentication events: `login_success`, `login_failure`, `password_reset_requested`, `password_reset_completed`, `mfa_enrolled`, `mfa_challenge_failed`, `session_revoked`, `logout`. The writer MUST accept the full enumerated action set in PRD §6 so later slices do not change the schema.
- **FR-020**: Reading audit rows MUST follow the matrix: Super Admin full history; Admin last 90 days; all other roles denied. A full export UI is out of scope.
- **FR-021**: CSRF protection MUST apply to every state-changing request. Cites PRD §8.
- **FR-022**: PII columns on the user record (including names, email, and MFA secret) MUST be encrypted at rest with application-layer AES-256-GCM. There is no vendor KMS. Full-disk encryption does not satisfy this. Email MUST remain usable as the login identifier. Cites PRD §8, Constitution Principle II.
- **FR-023**: Hostnames and connection strings MUST come from environment variables only. The slice MUST run locally against a local database with no DreamHost (or other production host) dependency. Cites Constitution Principle III.
- **FR-024**: Because registration is out of scope, local and test operation MUST use seeded accounts covering: Super Admin, Admin, Moderator, Pathways member, LEAD member, pending, denied, and deactivated.
- **FR-025**: Every row of the PRD §3 permission matrix MUST be asserted. Capabilities this slice implements MUST pass allow/deny as specified. Capabilities not yet built MUST fail closed (deny). The matrix MUST run twice: through the application, and directly against the database with the application bypassed. Cites Constitution Principle IV.
- **FR-026**: Every route handler delivered in this slice MUST have a test that it rejects an unauthorized role, not only that it accepts an authorized one.
- **FR-027**: Secrets, password hashes, MFA secrets, and reset tokens MUST NEVER appear in Git, test fixtures in recoverable form, or log lines.

### Key Entities

- **User**: Login identity; program role; administrative role; status (`pending` | `active` | `deactivated` | `denied`); MFA enrollment state; encrypted PII. Exactly one program role, zero or one administrative role.
- **Network**: Pathways to Change and LEAD only in this slice (see Assumptions / PRD §11 Q3). Maps to default program role.
- **Session**: Server-side record (hashed token, user, IP, user agent, created/last seen/expiry/revoked, MFA-satisfied). Required so logout and revoke work.
- **Password reset token**: Hashed, single-use, 60-minute expiry, consumed timestamp.
- **Audit log**: Append-only evidence row per PRD §6 System 1; references other records by id strings, not foreign keys.
- **Visibility-gated record**: Representative content entity with a visibility set; exists so layer 3 is provable before later content slices.

### Constraints (mandated by PRD §5.1 / §4 / §6 / §8 and Constitution; not open design)

This slice does not re-open stack or authorization choices. Plan and tasks MUST implement: credentials authentication with TOTP for administrative roles; server-side sessions; `requireRole` from the signed session; native PostgreSQL RLS on visibility-gated tables; Argon2id password hashing (bcrypt cost ≥ 12 only if Argon2 is unavailable); application-layer AES-256-GCM for PII; append-only audit writes in the same transaction as the change. Do not introduce a third-party auth vendor, a managed database's proprietary policy layer, or client-supplied roles as a source of truth.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An approved member with valid credentials reaches the member home in under 30 seconds of submitting the sign-in form (local, unthrottled).
- **SC-002**: 100% of unauthorized attempts in the permission matrix are denied on both the application run and the application-bypassed database run. Zero cross-role content leaks in those runs.
- **SC-003**: A Pathways member sees 0 LEAD-only records; a LEAD member sees 0 Pathways-only records; both see `all_authenticated` records.
- **SC-004**: 100% of admin-area requests from administrative users without MFA satisfied are denied. After enrollment and a valid challenge, authorized admin-area requests succeed according to role.
- **SC-005**: After log out or revoke, reuse of that session fails in 100% of attempts.
- **SC-006**: The 11th failed sign-in within 15 minutes is refused; user-visible copy for lockout, unknown email, denied, deactivated, and wrong password is identical.
- **SC-007**: A known user can complete password reset within 5 minutes of requesting it (token still valid); 100% of that user's prior sessions are invalid afterwards.
- **SC-008**: Each authentication event listed in FR-019 produces exactly one new audit row on success of the test action; existing rows cannot be changed through any product path.
- **SC-009**: The sign-in screen offers 0 remember-me controls; authenticated screens include a visible log-out control; a new browser session after close does not continue the previous session.
- **SC-010**: A developer following the documented local steps can sign in with a seed user against a local database without any production host.
- **SC-011**: Pending users reach only the holding page (0 member content records). Denied and deactivated users never receive a session.
- **SC-012**: A client-supplied role that would grant extra access never succeeds (0 extra records vs the signed session's roles).

## Assumptions

Named assumptions below are **recorded**, not silent. Constitution v1.1.0 requires this for PRD §11 dependencies.

### PRD §11 dependencies

| Question | Relevance to this slice | Decision in this spec |
| --- | --- | --- |
| **Q2** DOC affiliation field | User PII at registration | **Not required to implement this slice.** Seeded users need no DOC field. Registration remains out of scope. No silent default for the live field definition. |
| **Q3** Network name list | Role model and visibility tokens | **Proceed** on **Pathways and LEAD only**. Visibility tokens stay `all_authenticated \| pathways \| lead`. **Revisit** if the client adds networks before launch — additional program roles would expand the role model and RLS policies. |
| **Q6** Email provider | Password reset and MFA-related mail | **Proceed** locally with a captured/local mailbox so reset can be tested without Postmark. Production sender remains a later wiring task. |
| **Q7** Retention / funder commitments | Audit retention 7y security / 3y other (PRD §6) | **Proceed** on those PRD defaults as policy on the log. A weekly retention-sweep job is **out of scope** for this slice; the writer MUST still set `severity` so a later sweep can distinguish classes. |
| **Q8** FERPA / HIPAA / state regime | Auth and audit handling of PII | **Proceed** on the PRD preliminary read (neither FERPA nor HIPAA directly). This slice still encrypts PII at rest and keeps auth errors from leaking account state. |
| **Q11** Single Super Admin vs named group | MFA enrollment planning | **Proceed** with multiple administrative users allowed (seed at least one Super Admin). Enrollment flow is the same per administrative user. Separation-of-duties beyond the §3 matrix is not added. |
| **Q13** Data residency | Local database vs production region | **Not a hosting decision in this slice.** Local development uses a local database. Production residency remains gated by `001-infra-foundation` / ADR-0001. |
| **Q14** Future WordPress SSO | Identity model | **Proceed** with email-and-password only. Magic link and SSO are out of scope. |
| **Q17 / Q20** Operational ownership | Production operations | **Not a dependency.** This slice is local-runnable application work. |

### Other assumptions

- **Pending vs generic failure**: PRD §3 and the holding page allow pending members to sign in. PRD §5.1 edge-case text groups pending with deactivated, and the constitution requires identical **failure** messages for pending, denied, deactivated, and nonexistent. This spec treats **pending + correct password as a successful sign-in to holding**. Denied, deactivated, nonexistent, wrong password, and lockout share one generic failure. Wrong-password attempts on a pending account follow the generic failure (no status leak).
- **MFA recovery**: Lost-authenticator recovery is a Super Admin action (or operator re-seed in local). Backup codes are out of scope. A new session always requires a fresh challenge; enrollment is once per user until reset.
- **Admin-as-member**: Administrative users may have program role `none`. They still see `all_authenticated` content. Moderators see role-specific resources "for moderation" per the matrix; this slice's representative records treat Moderator as able to see both `pathways` and `lead` plus `all_authenticated`.
- **Invited token holders** cannot sign in. Invitation entities are not created here.
- **Email encryption vs lookup**: Email remains the login identifier; encryption at rest MUST NOT prevent looking up a user by email at sign-in.
- **Local Secure cookies**: Documented local HTTPS or an explicit local exception MUST be in the developer steps so Secure cookies can be tested; production always uses Secure.
- English-only UI (PRD §11 assumption).
- Launch cohort size does not change lockout or session rules.
