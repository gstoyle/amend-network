Amend Member Network Platform — PRD v1.1

**PRODUCT REQUIREMENTS DOCUMENT**

**Amend Member Network Platform**

*network.amend.us · Launch target: end of August 2026*

| **Field** | **Value** |
| --- | --- |
| Document version | 1.1 - Hosting revision (DreamHost VPS) |
| Date | April 16, 2026; revised August 12, 2026 |
| Prepared by | Product & Solutions Architecture |
| Prepared for | Amend (amend.us) - Executive sponsor, Program leads for Pathways to Change and LEAD |
| Status | Developer-ready. Adequate for sprint planning pending resolution of Section 11 open questions. |
| Revision note (v1.1) | Section 4 hosting and infrastructure revised at client direction to target DreamHost Self-Managed VPS. Sections 8, 9, 10, and 11 updated for the operational consequences. Functional requirements in Section 5 are unchanged except for storage-provider naming. |
| Change control | Any scope changes after v1.1 sign-off require written approval from the Amend executive sponsor. |

# 1. Executive Summary

### Product vision

The Amend Member Network is a private, role-based digital hub for participants in Amend's program network. It gives verified members a single trusted place to access program resources, coordinate events, connect with peers across cohorts, and engage in role-appropriate discussion - all operated to a privacy and security standard appropriate for a user base that works inside or alongside the correctional system.

### Problem

Today, Amend's program communications rely on email, ad-hoc file shares, and a public-facing WordPress site. That arrangement creates three connected problems:

- Content cannot be gated by role. Pathways to Change (Training Academies) and LEAD (Women's Prison Leadership) have distinct materials, events, and conversations, but the public site cannot segregate them.

- Member-to-member connection is invisible. There is no searchable directory, no forum, and no shared sense of cohort.

- Engagement is unmeasurable. Program staff cannot see who is reading what, attending what, or contributing - which makes it impossible to demonstrate program impact to funders or to steer program design with evidence.

### What the platform is (and isn't)

The Member Network is a standalone web application at a subdomain of amend.us (proposed: network.amend.us). It is not a replacement for the main WordPress marketing site, which continues to serve public audiences. The two systems are linked: the Member Network surfaces a role-aware feed of WordPress articles and uses WordPress brand tokens, but it is independently hosted, independently authenticated, and independently deployable.

### Primary launch audiences

- **Training Academies ****-**** Pathways to Change program. **Correctional staff participating in Amend's training cohorts.

- **Women's Prison Leadership ****-**** LEAD program. **Leadership cohort drawn from women's correctional institutions.

These are the MVP audiences. The architecture is designed so new program roles (e.g., alumni cohorts, subject-matter working groups, international programs) can be added post-launch without structural changes.

### What success at launch looks like

- The platform is live at the agreed subdomain by August 31, 2026.

- Both launch cohorts are fully onboarded - invited, registered, approved, and active - with zero known unauthorized cross-role content access incidents.

- Amend staff can, from a single admin dashboard, see registration status, engagement metrics, and an audit log sufficient for both internal review and funder reporting.

- The site is mobile-first and WCAG 2.1 AA compliant by launch, measured against automated scans and a manual accessibility review.

- Brand parity with the refreshed amend.us site is achieved through shared design tokens, so the experience feels like a continuation of Amend's identity rather than a separate product.

# 2. Goals & Success Metrics

### Strategic goals

- Provide a secure, role-segregated home for Amend program content and community.

- Make program engagement measurable, so staff and funders can see impact.

- Reduce program staff operational burden - replace ad-hoc email threads and file shares with a managed platform.

- Strengthen cross-cohort connection without compromising role separation or member privacy.

- Establish a maintainable technical foundation the Amend team can steward long-term with a small technical staff.

### Launch KPIs (first 90 days post-launch)

| **KPI** | **Target** | **Definition / instrumentation** |
| --- | --- | --- |
| Invitation → activation rate | ≥ 70% | Percent of invited users who complete registration and are approved within 14 days of invite send. |
| 30-day return rate | ≥ 55% | Percent of approved members who log in at least once in the 30 days following their first login. |
| Monthly active members (MAM) | ≥ 60% of approved members | Distinct members with ≥1 authenticated session per calendar month, segmented by role. |
| Time to approve new member | ≤ 48 business hours, p90 | Measured between registration submission and admin approval/denial. |
| Resource engagement | ≥ 2 downloads / active member / month | Counted via audit log on authenticated download endpoint. |
| Event RSVP rate | ≥ 40% of role-visible events | RSVPs ÷ unique members who viewed the event detail page. |
| Forum participation rate | ≥ 25% of MAM post or reply monthly | Counts any authored thread or reply in the calendar month. |
| Banner CTA CTR | ≥ 8% | Unique CTA clicks ÷ unique impressions, per active announcement. |
| Zero unauthorized access incidents | 0 | Audit-log review of any access attempt to content outside a user's role-permitted set. |
| Platform availability | ≥ 99.5% | Measured monthly, excluding pre-announced maintenance windows. |

### Event instrumentation required to surface these KPIs

The analytics/audit system must track, at minimum, the following events. A complete list is specified in Section 6.

- Authentication: login success, login failure, password reset request, password reset completion, MFA challenge, logout.

- Lifecycle: invitation sent, invitation accepted, registration submitted, registration approved/denied, account deactivated, role changed.

- Content: resource viewed, resource downloaded, event viewed, event RSVP (yes/no/waitlist), announcement impression, announcement CTA click, directory search, directory profile viewed, forum thread viewed, forum post created, forum post flagged.

- Admin: user approved/denied, content created/edited/deleted, role assigned, bulk invite sent, audit log exported.

# 3. Stakeholders & User Roles

### Internal stakeholders

| **Role** | **Primary interest** | **Involvement** |
| --- | --- | --- |
| Executive sponsor (Amend leadership) | On-time, on-brand launch; compliance posture | Approves scope, brand, and privacy policy; final sign-off |
| Program lead - Pathways to Change | Training Academies onboarding, resource library, event coordination | Provides content and cohort list; owns role-specific UAT |
| Program lead - LEAD | Women's Prison Leadership onboarding, safe discussion spaces, directory privacy defaults | Provides content and cohort list; owns role-specific UAT; drives privacy defaults |
| Communications / brand steward | Visual and tonal consistency with the refreshed amend.us site | Delivers brand tokens and asset library; reviews UI at design checkpoints |
| Technical lead (Amend or contracted) | Maintainability, operational cost, documentation quality | Owns the platform post-launch; participates in architecture decisions |
| Amend super admin(s) | Daily operation: approvals, moderation, content, analytics | User acceptance testing; daily driver of the admin experience |

### Platform user roles

The platform ships with the following roles. Every user has exactly one primary program role (Pathways or LEAD) and zero or one administrative role layered on top. This separation means an Amend staff member can be an Admin without being a program member, and a program member can be promoted to Moderator without losing their cohort identity.

#### Role definitions

| **Role** | **Type** | **Description** |
| --- | --- | --- |
| Super Admin | Administrative | Full control: user management, role assignment, system configuration, audit log access and export, integration credentials. Reserved for 2–3 named Amend staff. |
| Admin | Administrative | User approvals, content management (resources, events, announcements), directory moderation, forum moderation, analytics viewing. Cannot change system configuration or export the full audit log. |
| Moderator | Administrative | Forum moderation and event management only. No user management. |
| Pathways Member | Program | Training Academies cohort member. Access to Pathways-scoped content plus all shared content. |
| LEAD Member | Program | Women's Prison Leadership cohort member. Access to LEAD-scoped content plus all shared content. |
| Pending Member | Transitional | Registered but not yet approved. Can log in to a holding page, edit profile, and see that their request is under review. No access to resources, directory, forum, or events. |
| Invited (token holder) | Transitional | Has received an invitation link but not yet completed registration. Can access only the registration page via the invite token. |

#### Permission matrix

Columns are roles; rows are capabilities. Legend: ✓ = allowed, ✗ = denied, ● = allowed subject to the scope described in the Notes column.

| **Capability** | **Super Admin** | **Admin** | **Moderator** | **Pathways Member** | **LEAD Member** | **Pending** | **Invited** | **Notes** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Log in | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Invited users complete registration instead. |
| View dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ● | ✗ | Pending members see a 'request under review' holding page. |
| View shared resources | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |  |
| View role-specific resources | ✓ | ✓ | ● | ● | ● | ✗ | ✗ | Members see only their own role's resources. Moderators see all for moderation. |
| Download resources | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | Every download is audit-logged. |
| Upload / edit / delete resources | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| View events | ✓ | ✓ | ✓ | ● | ● | ✗ | ✗ | Filtered by role-visibility on the event. |
| RSVP to events | ✓ | ✓ | ✓ | ● | ● | ✗ | ✗ | Only to events they can see. |
| Create / edit / delete events | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | Moderators can edit events they did not create, with audit log. |
| View directory | ✓ | ✓ | ✓ | ● | ● | ✗ | ✗ | Subject to each member's privacy settings and role filtering. |
| Appear in directory | N/A | N/A | N/A | ● | ● | ✗ | ✗ | Default is opt-in. See §5.6 and [COMPLIANCE NOTE]. |
| View forum | ✓ | ✓ | ✓ | ● | ● | ✗ | ✗ | Categories are role-gated. |
| Post to forum | ✓ | ✓ | ✓ | ● | ● | ✗ | ✗ | Subject to category role scope and rate limiting. |
| Moderate forum (hide, delete, ban) | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |  |
| View announcements | ✓ | ✓ | ✓ | ● | ● | ✗ | ✗ | Role-targeted. |
| Create / manage announcements | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| Approve / deny registrations | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| Assign / change roles | ✓ | ● | ✗ | ✗ | ✗ | ✗ | ✗ | Admins can assign program roles but not administrative roles. |
| View analytics dashboard | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| View audit log | ✓ | ● | ✗ | ✗ | ✗ | ✗ | ✗ | Admins see last 90 days; Super Admins see full history and export. |
| Change system configuration | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Integration credentials, email templates, retention settings. |

### Role lifecycle

A user transitions through roles as follows:

- Invited (optional) → Pending on registration submission.

- Pending → Pathways Member or LEAD Member on admin approval; or denied (account archived, not deleted, for audit integrity).

- Pathways / LEAD Member → optionally promoted to Moderator or Admin by a Super Admin.

- Any role → Deactivated by an Admin (retains data for audit, loses all access). Hard deletion is reserved for data subject requests and is performed by a Super Admin with logged justification.

# 4. Technical Architecture & Stack Recommendation

### Decision criteria

The stack must satisfy seven constraints: **deployability on DreamHost infrastructure (client-directed, see §11 Q20)**, subdomain hosting alongside a WordPress site, role-based access control, mobile-first responsiveness, integration with the WordPress blog, long-term maintainability by a small team, and cost efficiency appropriate for a nonprofit.

The hosting constraint is load-bearing and narrows the field before anything else does. DreamHost shared hosting and DreamPress cannot run a Node.js or Python application server; Node applications are supported only on VPS and Dedicated plans, and attempting to compile a runtime on a shared plan can trigger account lockout. Managed VPS provides no root access. The only DreamHost product that can host this application is **Self-Managed VPS**, which provides full root access, Docker and KVM support, and an application library that includes PostgreSQL.

Critically, the hosting constraint does **not** force a framework change. It forces an infrastructure change. Next.js runs on any host that runs Node. Those criteria steer toward consolidation - one framework, one deployment target, one source of truth for auth - rather than a collection of microservices.

### Stack options evaluated

| **Option** | **Strengths** | **Tradeoffs** |
| --- | --- | --- |
| A. Next.js 14+ (App Router) full-stack, TypeScript | Single codebase (frontend + API routes + server actions). Excellent TypeScript ergonomics. First-class RBAC via middleware. Huge ecosystem (Auth.js, Tailwind, shadcn/ui). Runs anywhere Node runs, including a self-managed VPS in standalone output mode. React-based - leverages client team's existing React familiarity. | React/JS-only team required. Server actions and App Router patterns are newer and change somewhat faster than Django or Flask norms. Self-hosting forgoes platform conveniences (image optimisation defaults, zero-config preview deploys) that must be replaced with owned infrastructure. |
| B. FastAPI (Python) + React (Vite), split front/back | Matches client's existing FastAPI + React familiarity. Clear separation of concerns. Strong Python ecosystem for later data/analytics work. Easy to add async background workers. | Two codebases, two deployments, two deploy pipelines. Auth wiring between them is a recurring source of bugs. More surface area for a small team to maintain. |
| C. Django 5 + HTMX + Alpine | Batteries included: admin interface, ORM, auth, permissions all native. Very low JS footprint. Excellent long-term maintainability. | Django admin looks like Django admin - extensive UI work needed to match Amend brand. HTMX patterns are newer to most teams. Less forgiving if the team later wants a rich SPA feel. |
| D. WordPress multisite with membership plugin (e.g., MemberPress, BuddyBoss) | Cheapest to stand up. Same CMS skill set as the main site. | Fights the use case. Fine-grained RBAC, audit logging, and custom forum moderation are all plugin-dependent and brittle. Long-term cost of ownership is high. Security surface is the entire WP plugin graph. |

| **[RECOMMENDATION]** Adopt Option A: Next.js 14+ (App Router) with TypeScript. It consolidates the frontend and backend into a single codebase maintainable by one or two engineers, supports the mobile-first React-based UI the brand will expect, integrates cleanly with WordPress via its REST API, and has the strongest ecosystem for RBAC, design tokens, and accessible component libraries. Option B (FastAPI + React) is a strong second choice if the maintaining team is Python-primary; if chosen, nothing else in this PRD changes materially. |
| --- |

### Recommended stack

| **Layer** | **Recommendation** | **Rationale** |
| --- | --- | --- |
| Application framework | Next.js 14+ (App Router), TypeScript | Single-codebase full-stack React. Server components reduce client bundle size for mobile. |
| UI / design system | Tailwind CSS + shadcn/ui, tokens in CSS variables | Fast to build, accessible defaults, token-driven so brand updates are a config change. |
| Authentication | Auth.js v5 (NextAuth) - credentials + optional magic link; TOTP MFA for admins | Mature, framework-native, supports password + email flows and adds MFA without vendor lock-in. Alternative: Clerk, faster to implement but adds a recurring SaaS line item. |
| Database | PostgreSQL 16, self-hosted on the application VPS | Relational model fits the domain. **Row-level security is a native PostgreSQL feature, not a Supabase one**, so the third enforcement layer described below survives self-hosting intact. Co-resident with the app at MVP scale; separable onto its own VPS without application change. |
| ORM | Prisma (or Drizzle if team prefers SQL-first) | Migrations, types, and ergonomics. Drizzle is lighter and closer to SQL - either is fine. |
| File storage | DreamObjects (S3-compatible) | Keeps storage on the client-directed provider and on the same bill. S3-compatible, so the private-bucket plus signed-URL pattern is identical to any other S3 provider and the application code is provider-agnostic behind an `S3Client`. Migration to R2 or S3 later is a config change. |
| Transactional email | Postmark | Excellent deliverability, simple API, reasonable nonprofit pricing. Resend is a fine alternative. |
| Error monitoring | Sentry | Free tier covers a nonprofit at this scale; nonprofit discount available. |
| Product analytics | PostHog (EU Cloud or self-hosted) | See §6. EU hosting / self-hosting addresses the correctional-context privacy concerns that Mixpanel or GA4 would raise. |
| Hosting | DreamHost Self-Managed VPS, Ubuntu 24.04 LTS | Full root access, Docker and KVM support, unmetered bandwidth, NVMe SSD, DDoS protection, and an infrastructure-level uptime SLA. **Sizing: Stack 16 (4 vCPU, 16 GB RAM, 250 GB NVMe) for production**, which accommodates the Node process and a co-resident PostgreSQL instance with headroom for the §8 scalability target. Stack 8 (8 GB) is the floor and leaves little room for Postgres tuning. A second, smaller instance (Stack 4) serves staging, which §10 requires for the 14-day pre-launch soak. |
| Runtime & process | Node.js 24 LTS under systemd, nginx reverse proxy, Let's Encrypt via certbot | systemd over PM2: one less dependency, native journald logging, and restart-on-failure without a supervisor process of its own. nginx terminates TLS and proxies to the Node process on a non-privileged port. |
| Background jobs | System cron invoking authenticated internal endpoints or Node scripts | Announcement activation/expiration, digest emails, invite expiration sweeps, WordPress feed refresh, retention sweeps. Simpler and more debuggable than a platform cron abstraction, with no per-invocation billing. |
| CI/CD | GitHub Actions → SSH deploy to staging on merge, manual promotion to production | Build, lint, typecheck, test, a11y scan, and Lighthouse budget gate run in Actions; a deploy job rsyncs the build artefact and restarts the systemd unit. **Per-PR preview environments are not free on this infrastructure.** Two options: accept a single shared staging environment (recommended at MVP), or run Dokploy on the staging VPS to get containerised per-branch previews at the cost of an additional moving part. |
| Secrets management | systemd `EnvironmentFile` with 0600 permissions, sourced from 1Password Secrets Automation or Doppler at deploy time | No secrets in Git and none written to the repo working directory on the server. Rotation workflow documented in the operations runbook. |

### High-level architecture

The platform is a single Next.js application running in standalone output mode on a DreamHost Self-Managed VPS at network.amend.us, supervised by systemd and fronted by nginx for TLS termination and reverse proxying. Cloudflare sits in front of the VPS for DNS, WAF, rate limiting, and bot protection. With no managed platform edge in the path, **Cloudflare is now the only edge protection layer and is therefore mandatory rather than optional**. The app authenticates users against a PostgreSQL database via Auth.js, stores role claims in a signed JWT session cookie, and enforces authorization at three layers:

- Route middleware. Every route under /app/* and /admin/* requires a session. Unauthenticated requests redirect to /login.

- Server-side role checks. Every data-fetching server component or API route calls a requireRole(...) helper before returning data. Role is read from the session JWT, never from the client.

- Database row filtering. Queries include role-based WHERE clauses, and PostgreSQL row-level security policies are enabled on every content table to provide a second, independent enforcement layer that holds even if an application-layer check is missed. RLS is native to PostgreSQL 16 and requires no managed-database vendor.

Uploaded files are stored in a private DreamObjects bucket, accessed through the standard S3 API so the storage provider is swappable behind a single client wrapper. Downloads are served via short-lived signed URLs issued only after a server-side role check. The WordPress blog is polled every 15 minutes via its REST API; results are cached server-side in the database so the sidebar does not hit wordpress on every page load.

### Subdomain and DNS

network.amend.us is proposed as the subdomain (pending client confirmation - see §11). DNS resolves to Cloudflare, which proxies to the VPS public IP (A and AAAA records; the VPS provides dual-stack IPv4 and IPv6). The origin is locked to Cloudflare IP ranges at the firewall so the VPS cannot be reached directly, which prevents attackers from bypassing the WAF by hitting the origin address. The main amend.us WordPress site is unaffected. Authentication is scoped to the subdomain - there is no single sign-on with WordPress at launch, and a decision to add SSO later is non-breaking.

### Authorization model

Authorization is attribute-based at the perimeter and role-based in practice:

- A user's session carries: user id, primary program role (Pathways / LEAD / none), administrative role (Super Admin / Admin / Moderator / none), status (active / pending / deactivated), and MFA-satisfied flag.

- Content entities (resources, events, forum categories, announcements) carry a visibility set - one or more of: all_authenticated, pathways, lead. A user sees an entity if any of their roles intersects its visibility set.

- Administrative capabilities are gated on the administrative role claim independently of the program role.

### Cost envelope at MVP scale

For the launch cohort sizes and usage levels implied by the KPIs, monthly platform cost is expected to sit in the **low three-figure range, below the managed-platform alternative**. Indicative recurring line items:

| Item | Introductory | Renewal |
| --- | --- | --- |
| Production VPS (Stack 16) | $15.49/mo | $23.49/mo |
| Staging VPS (Stack 4) | $5.99/mo | $10.99/mo |
| DreamObjects storage | usage-based, low | usage-based, low |
| Postmark, PostHog, Sentry, Cloudflare | nonprofit / free tiers where available | as above |

Introductory VPS pricing is a two-year prepaid term; the renewal column is the rate the client inherits afterwards and is the number that belongs in a multi-year budget. Detailed line items are deferred to a separate operations handbook.

**The saving is not free.** Roughly $100/month of managed-platform cost is being exchanged for operational labour: OS patching, TLS renewal monitoring, backup verification, restore drills, and incident response. That labour is a real Phase 0 and post-launch cost and is called out in §8 and §11.

# 5. Functional Requirements

Each feature below is specified with a primary user story, acceptance criteria, edge cases and business logic, and dependencies. Where a feature has significant privacy implications, a [COMPLIANCE NOTE] is attached.

## 5.1 Authentication & Access Control

**User story. **As a member, I want to log in with credentials that are only mine so that I can access content appropriate to my role and trust that others cannot impersonate me.

#### Acceptance criteria

- Email address is the login identifier. Passwords are minimum 12 characters with no composition rules, aligned with NIST SP 800-63B guidance.

- Passwords are hashed with Argon2id (or bcrypt cost ≥ 12 if Argon2 is unavailable in the chosen runtime).

- Sessions are delivered in httpOnly, Secure, SameSite=Lax cookies. Session lifetime is 24 hours sliding, with a 30-day absolute maximum before re-authentication.

- Admins (Super Admin, Admin, Moderator) must enroll a TOTP authenticator at first login; the session carries an mfa_satisfied flag that is required for any /admin route.

- Account lockout: 10 failed attempts within 15 minutes temporarily locks the account for 15 minutes and logs a security event. The lockout does not reveal whether the account exists.

- Password reset is email-token-based with 60-minute single-use tokens. Reset completions force invalidation of all existing sessions for that user.

- Logout invalidates the server-side session record, not only the cookie.

#### Edge cases and business logic

- Deactivated users attempting to log in receive the same 'account not active' message whether the account is pending, deactivated, or denied. The specific reason is not leaked.

- Password reset requests for non-existent emails return success to the user but are recorded as a distinct event in the audit log for abuse monitoring.

- Concurrent sessions are permitted (a user may be logged in on phone and laptop), but all sessions are listed on a profile 'active sessions' page with one-click revoke.

| **[COMPLIANCE NOTE]** Given the correctional-system context, shared-device access is likely. Session cookies must expire on browser close in addition to the 24-hour sliding window, and a prominent 'log out' affordance must be present on every page. Do not offer 'remember me' on this platform. |
| --- |

#### Dependencies

- Email service (Postmark) for reset and MFA enrollment flows.

- Session store in PostgreSQL - required for server-side revoke.

## 5.2 Registration & Invitation Flow

**User story (member). **As a prospective member, I want to register for the network - either from an invitation or on my own - so that an Amend admin can approve me and give me access to my cohort's resources.

**User story (admin). **As an admin, I want to bulk-invite a cohort and to review pending requests so that only verified members access the platform.

#### Required registration fields

| **Field** | **Required** | **Type** | **Notes** |
| --- | --- | --- | --- |
| First Name | Yes | Text | Trimmed, max 80 chars. |
| Last Name | Yes | Text | Trimmed, max 80 chars. |
| DOC affiliation | Yes | Text / dropdown | See open question in §11. Likely the corrections agency or facility the user is affiliated with. Encrypted at rest. |
| Title / Role | Yes | Text | Free text, e.g., 'Warden', 'Training Officer', 'Peer Leader'. |
| Email address | Yes | Email | Unique across the system. Login identifier. |
| Network Name | Yes | Dropdown | Pathways to Change, LEAD, or future networks. Determines program role on approval. Full list to be confirmed - §11. |
| Password | Yes | Password | Only on self-registration; invited users set password via invite token flow. |

#### Acceptance criteria - self-registration

- A prospective member can reach /register directly and submit the form. The submission creates a user in Pending status.

- Submission triggers two emails: a confirmation to the user ('we received your request') and a notification to admins.

- The user cannot log in to any non-holding route until an admin approves them.

- Duplicate email submissions (active or pending account) return a generic 'if this email is eligible, you will receive instructions' message and do not reveal account state.

#### Acceptance criteria - admin-initiated invitation

- An admin can open /admin/users/invite and either enter invitees manually (email + first + last + network) or upload a CSV with columns: email, first_name, last_name, network_name, title, doc_affiliation.

- CSV is validated before send. Rows with missing required fields, duplicate emails (already a member), or unknown network names are surfaced in an error report; the admin can correct and re-submit only the bad rows.

- Each valid row generates an Invitation record with a cryptographically random single-use token (≥128 bits of entropy), expires_at = now + 14 days, and an email with the unique invite link.

- Clicking the invite link opens a pre-filled registration form (name and network pre-populated, email locked). On submission, the user is created directly in the assigned role - no pending step, because the invitation itself is the vetting.

- Invite tokens are single-use. Re-clicking a consumed link shows 'this invitation has already been used - please log in or request a password reset.'

#### Acceptance criteria - approval workflow

- Admins see a Pending Registrations queue at /admin/users/pending, sorted oldest-first, with filters by requested network.

- Each pending record shows the submitted fields, submission timestamp, and IP address (for admin review only - never shown to other members).

- Approval assigns a program role (default: the requested network) and activates the account; denial archives the record with an optional admin-visible reason.

- Approval triggers a welcome email with a set-password link (if the user did not set one during self-registration) or a 'you're in' email (if they did).

- Denial triggers a polite email with no specific reason cited. The specific admin-entered reason is retained in the audit log only.

#### Email notification triggers

| **Trigger** | **Recipient** | **Purpose** |
| --- | --- | --- |
| Invitation sent | Invited user | Includes invite link and 14-day expiry |
| Self-registration submitted | User | Confirms receipt |
| Self-registration submitted | Admins (group alias) | Alerts them to the new pending record |
| Registration approved | User | Welcomes, provides set-password link if needed |
| Registration denied | User | Polite decline, no specific reason |
| Invite expiring soon | Invited user + inviting admin | Sent 3 days before expiry |
| Invite expired | Inviting admin | So they can re-issue if needed |

| **[COMPLIANCE NOTE]** The DOC affiliation field may be considered sensitive information depending on how it is defined. It must be encrypted at rest (column-level encryption or application-layer AES-256-GCM) and must not appear in the directory unless the user has explicitly opted in to DOC-field visibility. It must not be sent to product analytics. Final definition of this field is an open question in §11. |
| --- |

## 5.3 Event Calendar

**User story. **As a member, I want to see upcoming events relevant to my role and RSVP to those that allow it, so that I can participate in program activities.

#### Acceptance criteria

- Members see a calendar view (month/list toggle) of events whose visibility set includes their program role.

- Event detail pages display: title, rich-text description, start/end datetime (member's local timezone), location (physical address or virtual link), capacity (optional), host, and RSVP controls.

- RSVP flow supports Yes / No / Maybe. Yes RSVPs can be capped; when capacity is reached, further Yes RSVPs are placed on a waitlist.

- An ICS file is downloadable from each event page; RSVPing also sends a calendar invite.

- Reminder emails send 24 hours before start to all Yes RSVPs.

- Admins and Moderators can create, edit, and cancel events; cancellation notifies all RSVPs.

- Virtual event links (Zoom, Teams, Google Meet) are revealed only to Yes RSVPs and only within 1 hour of event start, to discourage leakage.

#### Edge cases

- Editing an event's date/time after RSVPs exist triggers a 'notify RSVPs' dialog with an optional custom message.

- Deleting an event is a soft-delete - the record and its RSVPs remain for audit, but the event disappears from member views.

- Timezone: events are stored in UTC and rendered in the viewer's timezone. The admin editor displays both.

#### Dependencies

- ICS generation library (ics for Node).

- Postmark for RSVP confirmations and reminders.

## 5.4 Announcement Banners with CTAs

**User story. **As an admin, I want to place time-limited, role-targeted announcements with call-to-action links at the top of the member experience, so that I can drive attention to time-sensitive program moments.

#### Acceptance criteria

- Announcements support rich text (bold, links, inline emphasis), a headline, a body, and up to two CTA buttons (label + URL).

- Each announcement has an activates_at and expires_at timestamp. The banner is rendered only when now ∈ [activates_at, expires_at].

- Each announcement has a visibility set (all_authenticated, pathways, lead, or any combination). Members only see banners whose visibility set intersects their role.

- Banners are dismissable; dismissal is per-user per-announcement, stored in the database, and does not resurface the banner for that user.

- Admins see a /admin/announcements queue showing scheduled, active, and expired banners, with sort and filter.

- Banner impressions and CTA clicks are tracked (see §6).

- No more than two active banners may be visible to any one user at a time. If more are eligible, the most recently activated two are shown.

#### Edge cases

- activates_at in the past on create: the banner goes live immediately.

- expires_at before activates_at: rejected at validation.

- A scheduled banner whose visibility is changed before activation keeps its new visibility set.

## 5.5 Gated Resource Library

**User story (member). **As a member, I want to browse and download program resources relevant to my role, so that I can use them in my work.

**User story (admin). **As an admin, I want to upload and organize resources with the right tags and visibility, so that the right members find them.

#### Acceptance criteria

- Resource fields: title (required), preview text (required, up to 500 chars), thumbnail image (required), source label / tag (required - e.g., 'Amend', 'Partner Org', 'External'), free-form tags (0–10), file upload (required; PDF, DOCX, XLSX, PPTX, JPG, PNG, MP4 supported up to 250MB), visibility set.

- Resource list page supports keyword search (title + preview text), tag filter (chips), source filter, and sort (newest, most downloaded, alphabetical).

- Downloads are served via signed, short-lived URLs generated only after a server-side role check. Direct object-storage bucket URLs are never exposed.

- Every download is audit-logged (user id, resource id, timestamp, IP).

- Admins can edit metadata in place, replace the file while preserving the resource ID, and soft-delete (resource disappears from member view, file remains for audit period).

- Resource page shows a 'last updated' date so members know the content is current.

#### Edge cases

- File upload failures mid-stream do not create a partial resource - creation is atomic at the database layer after the object-storage upload confirms.

- Resources with video files show a streaming player inline, served via range requests against a signed object-storage URL, rather than forcing download.

- Resources visible to multiple roles are stored once; the visibility set controls presentation.

## 5.6 Member Directory

**User story. **As a member, I want to find and connect with other members in my program, so that I can build cohort relationships and ask questions of peers.

#### Acceptance criteria

- Directory is searchable by name, title, DOC affiliation (if the target member has that field set to visible), and network.

- Directory results show only those members who have opted in to directory visibility. Default is opt-in during the approval welcome flow, surfaced as a single clear toggle.

- Each member profile supports field-level privacy toggles: show/hide DOC affiliation, show/hide title, show/hide email. Name and network are always visible when the overall profile is visible.

- An avatar is optional; a consistent default (initials on brand color) is used otherwise.

- Directory searches are rate-limited to 30 per minute per user to discourage scraping.

- A profile view records a directory_profile_viewed event with the viewer and viewed user IDs (see §6).

#### Edge cases

- Deactivated members are immediately removed from directory results regardless of their prior opt-in state.

- Members cannot see members of the other program in the directory (LEAD members see LEAD; Pathways see Pathways). Admins see all.

| **[COMPLIANCE NOTE]** Default directory visibility for this user base should be OPT-IN - presented clearly during the approval welcome flow with plain-language explanation of who can see the profile and which fields. An opt-OUT default could inadvertently expose affiliations that members reasonably expect to remain private. The client should confirm this default with the LEAD program lead specifically, given the heightened sensitivity of the incarcerated-leadership cohort. |
| --- |

## 5.7 Community Forum / Discussion Board

**User story (member). **As a member, I want to read and participate in threaded discussions with my cohort (and sometimes cross-cohort), so that I can learn from peers and share what is working.

**User story (admin). **As an admin or moderator, I want clear tools to remove harmful content and manage poor-faith participants, so that the forum stays a safe space for the cohort.

#### Acceptance criteria

- Forum is organized into Categories (e.g., 'Pathways - Welcome', 'LEAD - Welcome', 'All Members - General'). Each category has a visibility set.

- Categories contain Threads; threads contain Posts. Threads and posts support markdown with a strict allowlist (no raw HTML, no embedded scripts, images only via upload to object storage through the existing resource-upload infrastructure).

- Members can start a thread in any category they can see. Members can reply to any thread they can see.

- Members can subscribe to a thread for email notifications on new posts; unsubscribe is one-click from the email.

- Members can flag a post. Flags are visible to moderators in a /admin/forum/flags queue with the flagged content, reporter, and reason.

- Moderators can: hide a post (removes from member view, preserves in database), delete a post (also removes from audit view but logs the action), lock a thread (no further posts), pin a thread within a category, and temporarily suspend a user from posting (does not remove their existing content).

- Rate limits: 1 new thread per minute, 5 posts per minute, 30 posts per hour per member. Admins are exempt.

- Every post creation, edit, and moderation action is audit-logged with actor and target.

- Post edit window is 15 minutes; after that, edits require admin/moderator action. This discourages revisionist editing of conversations.

#### Notifications

- Subscription model: per-thread follow, plus an optional weekly digest of new threads in categories the user can access.

- @-mentions in posts notify the mentioned user if they are visible to the mentioner (shared cohort or admin).

| **[COMPLIANCE NOTE]** User-generated content in a correctional-system context requires especially clear community guidelines, a published moderation policy, and a documented escalation path for content that might indicate harm. Moderation policy drafting is flagged as a cross-functional task involving Amend program staff, not only a technical configuration. Identified as an open question in §11. |
| --- |

## 5.8 WordPress Blog Sidebar Feed

**User story. **As a member, I want to see recent relevant articles from the main Amend site in the context of the network platform, so that I stay current with public-facing program news without leaving the member experience.

#### Acceptance criteria

- A sidebar widget on the dashboard and selected other pages shows the 5 most recent articles from amend.us.

- Each item shows featured image, title, excerpt (≤160 chars), publication date, and a 'Read on amend.us' link that opens in a new tab.

- The feed is fetched server-side every 15 minutes and cached, so page loads are fast and the WordPress site is not rate-pressured.

- If the WordPress site is unreachable, the sidebar shows the last successful fetch with a subtle 'as of [time]' marker rather than an error.

- Articles can optionally be filtered by WordPress category or tag - configurable by Super Admin - to support role-aware surfacing (e.g., articles tagged 'pathways' surface only to Pathways members).

| **[RECOMMENDATION]** Integrate via the WordPress REST API (/wp-json/wp/v2/posts) rather than RSS. REST returns structured fields (featured_media, categories, tags, excerpt) that RSS does not, enables category/tag filtering server-side, and scales to future needs (e.g., pulling author bios or custom post types) without changing integration method. The REST endpoint is enabled by default in modern WordPress; confirm it is not firewalled on the rebuilt amend.us site (§11). |
| --- |

#### Dependencies

- WP REST API reachable from the Next.js server.

- Database table for cached feed entries with a fetched_at timestamp.

- Background job (system cron) running every 15 minutes to refresh cache.

# 6. Analytics & Audit System

Amend needs two overlapping but distinct capabilities: a tamper-resistant audit trail for compliance and security, and product analytics for engagement measurement and program impact. These are best served by separate systems with different retention and privacy profiles.

| **[RECOMMENDATION]** Implement BOTH a custom audit-log table (authoritative, append-only, retained for the full policy period) AND a product analytics platform (PostHog, EU Cloud or self-hosted) for flexible engagement analysis. Do not conflate them. The audit log is evidence; the analytics platform is insight. |
| --- |

### System 1 - Custom audit log

A single append-only PostgreSQL table, written synchronously on every auditable event. Rows are never updated or deleted within the retention window; corrections are new rows.

#### Schema

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | bigserial PK |  |
| created_at | timestamptz | Indexed |
| actor_user_id | uuid nullable | Null for anonymous events (failed logins against unknown emails) |
| actor_role | text | Snapshot of actor's role at event time |
| action | text | Enumerated, see event list below |
| entity_type | text nullable | e.g., 'resource', 'user', 'event', 'forum_post' |
| entity_id | text nullable | The target record ID |
| target_user_id | uuid nullable | For events that affect another user |
| ip | inet | Request IP |
| user_agent | text | Raw UA string |
| metadata | jsonb | Event-specific payload (e.g., old/new role on role change) |
| severity | text | info │ warning │ security |

#### Events tracked in the audit log

The audit log captures security-relevant and admin-action events. Per-page-view tracking is handled by the analytics system, not here.

| **Category** | **Events** |
| --- | --- |
| Authentication | login_success, login_failure, password_reset_requested, password_reset_completed, mfa_enrolled, mfa_challenge_failed, session_revoked, logout |
| Lifecycle | invitation_sent, invitation_accepted, invitation_expired, registration_submitted, registration_approved, registration_denied, account_deactivated, account_reactivated, account_hard_deleted, role_assigned, role_changed |
| Content - resources | resource_created, resource_edited, resource_deleted, resource_downloaded |
| Content - events | event_created, event_edited, event_cancelled, event_rsvp |
| Content - announcements | announcement_created, announcement_edited, announcement_deleted |
| Forum | post_created, post_edited, post_flagged, post_hidden, post_deleted, thread_locked, thread_pinned, user_forum_suspended |
| Directory | directory_privacy_changed, directory_profile_viewed (sampled) |
| Admin | audit_log_viewed, audit_log_exported, bulk_invite_sent, system_setting_changed |

### System 2 - Product analytics platform

PostHog is recommended over Mixpanel or GA4. Reasons:

- PostHog supports EU Cloud hosting and full self-hosting, either of which keeps user behavior data out of US advertising ecosystems - important given the correctional context.

- Event taxonomy is identical to what the platform emits to the audit log (minus security events), so a single instrumentation pass covers both.

- Session replay can be disabled entirely, which is the correct default here; no recording of authenticated sessions without explicit Super Admin decision.

- Autocapture is also disabled in favor of explicit named events, to avoid inadvertently capturing PII in text inputs.

- Plausible is a reasonable lighter alternative if the client wants nothing more than aggregate pageview counts, but it cannot power the engagement KPIs in §2.

| **[COMPLIANCE NOTE]** Do not send DOC affiliation, email addresses, DOC ID values, names, or any free-text content (forum post bodies, event descriptions) to the product analytics platform. Send only opaque user IDs and role labels. Configure the analytics client with a PII-denylist and validate via an outbound-traffic test before launch. |
| --- |

### Admin dashboard requirements

The admin dashboard at /admin/analytics surfaces the KPIs from §2 plus the operational views below:

- Top-line cards: total approved members, MAM, pending registrations, content counts.

- Funnels: invitation → registration → approval → first-login → 30-day retention. Segmentable by network.

- Engagement leaderboards: top 10 most-downloaded resources, top 10 most-viewed threads (past 30 days), most-attended events. Used by program staff for content planning, not for member-ranking.

- Moderation workload: open flags, resolved flags, average time-to-resolution.

- Audit log viewer: paginated, filterable by actor, action, date range, severity. Export to CSV is Super Admin only and itself audit-logged.

### Data retention policy

| **Data class** | **Retention** | **Rationale** |
| --- | --- | --- |
| Audit log - security events | 7 years | Align with common records-management expectations; supports security incident forensics. |
| Audit log - non-security events | 3 years | Sufficient for program-year reviews and funder reporting. |
| Product analytics events | 24 months | Two program cycles - supports trend analysis without open-ended accumulation. |
| Deactivated user records | Indefinite (anonymization after 3 years of inactivity) | Preserves audit integrity while shrinking PII surface over time. |
| Session cookies / server sessions | Expired at 30 days absolute | See §5.1. |
| Password reset tokens | 60 minutes | Single-use, short TTL. |
| Invitation tokens | 14 days | See §5.2. |

Retention rules are enforced by a weekly background job. All retention deletions are themselves recorded in the audit log with row counts.

| **[COMPLIANCE NOTE]** Retention periods are proposed defaults. Final values should be reviewed against any Amend contractual obligations with DOC partners, any funder requirements, and applicable state law. See §11. |
| --- |

# 7. Branding & UI/UX Requirements

### Brand parity strategy

Because the refreshed amend.us WordPress brand is still being finalized, the Member Network must be built with a design system that absorbs brand changes as late as possible without a redesign pass. The strategy has three layers:

- Design tokens as CSS custom properties in a single tokens.css file (colors, typography scale, radius, shadow, spacing). Tailwind's theme config reads from these variables so utility classes like bg-primary or text-heading stay semantic.

- A shared tokens manifest (tokens.json) that the WordPress brand team can update. A small script converts the manifest to tokens.css at build time. When the WP team ships updated guidelines, the manifest changes and the platform re-deploys with zero component edits.

- A component library built on shadcn/ui, themed entirely through tokens. Components never hard-code color or font values.

### Mobile-first responsive design

- Layouts are designed at 360px width first; progressively enhanced at 640, 768, 1024, and 1280px.

- All interactive targets are ≥ 44×44 CSS pixels (WCAG 2.5.5, Apple HIG).

- Navigation on mobile uses a bottom bar for the primary 4 actions (Home, Resources, Forum, Profile) with a hamburger for secondary items.

- No content requires horizontal scroll at 360px except data tables, which are explicitly scroll-containerized with a visible scroll hint.

### Accessibility - WCAG 2.1 AA target

- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and interactive UI boundaries. Token review enforces this.

- Full keyboard navigation: every interactive element is reachable via tab, activated via enter/space, with a visible focus indicator that meets 3:1 contrast against adjacent colors.

- Semantic HTML: landmarks (header/nav/main/aside/footer), heading hierarchy, lists as lists, labels on all form controls.

- Screen-reader pass with NVDA (Windows) and VoiceOver (iOS) on the 5 most-trafficked pages as part of pre-launch QA.

- Motion: reduced-motion media query respected; no auto-playing video; no animations longer than 5 seconds without user control.

- Automated a11y checks (axe-core) run in CI and fail the build on new critical or serious issues.

### Design artefacts expected

- Brand token manifest (colors, type, spacing, radii) from the WP brand team - latest usable delivery date: mid-June 2026 to stay in the Phase 1 window.

- Logo package (primary, mono, favicon, app icon) in SVG + PNG.

- Any brand photography / illustration that should appear in the app shell (welcome screen, empty states).

# 8. Non-Functional Requirements

### Performance

- Largest Contentful Paint (LCP) ≤ 2.5s at p75 on a 4G mobile connection.

- Time to First Byte ≤ 600ms at p75 from continental US.

- Cumulative Layout Shift ≤ 0.1.

- Interaction to Next Paint ≤ 200ms at p75.

- JS bundle budget: ≤ 180 KB gzip for the authenticated shell. Per-route code-splitting via React Server Components minimizes this.

### Security

- TLS 1.3 required; HSTS with preload; HTTP redirects to HTTPS at the edge.

- Strict Content Security Policy: self + DreamObjects bucket origin + PostHog domain; no unsafe-inline.

- CSRF protection on all state-changing requests (double-submit cookie or framework-native CSRF token).

- All PII - names, email, DOC affiliation, title - encrypted at rest at the column level using application-layer AES-256-GCM. **There is no managed KMS on this infrastructure.** The data encryption key is held in the systemd environment file (0600, root-owned) and mirrored in the secrets manager; the rotation procedure and the re-encryption migration are documented in the operations runbook before launch. Full-disk encryption on the VPS is not a substitute for column-level encryption and does not satisfy this requirement.

- Uploaded files are scanned for malware at ingest by a ClamAV daemon running on the VPS, invoked synchronously before the resource record is marked downloadable. Running ClamAV as a local daemon is simpler here than the serverless equivalent and removes a network hop.

- MFA required for all administrative roles.

- Dependency scanning via GitHub Dependabot; weekly review of high/critical advisories with SLA of 7 days to patch critical.

- **Operating system patching is the platform owner's responsibility, not the host's.** Unattended-upgrades is enabled for security updates; kernel and major-version upgrades are applied in a scheduled monthly maintenance window. SSH is key-only with password authentication disabled, root login disabled, and a firewall (ufw or nftables) permitting only 22 from an allowlist plus 80/443 from Cloudflare ranges. fail2ban is enabled on the SSH and application auth endpoints.

- TLS certificate renewal is automated via certbot with a monitored renewal hook. A failed renewal must page, not fail silently.

- A pre-launch security review is scheduled in Phase 2 (§10). A follow-up third-party penetration test within 90 days of launch is recommended.

### Privacy

- Published privacy notice specific to the Member Network (distinct from amend.us).

- Self-service data access and deletion via profile → 'My data' - exports profile and activity log; deletion request is reviewed by a Super Admin and either fulfilled (hard delete + audit entry) or denied with reason.

- PII minimization: analytics events never carry PII; error monitoring (Sentry) is configured with PII scrubbers on request/response bodies.

### Availability & reliability

- Uptime target 99.5% monthly, excluding pre-announced maintenance windows of ≤ 2 hours outside business hours. DreamHost provides an infrastructure-level uptime guarantee covering hardware, network, and connectivity. **That guarantee does not cover the application.** A crashed Node process, a failed migration, or an exhausted disk is an Amend-side outage, and single-node deployment means there is no automatic failover. Meeting 99.5% is an operational commitment, not a purchased one.

- Single-node risk is accepted at MVP. The mitigations are: systemd `Restart=always` with health-check probing, disk and memory alerting to the on-call address, and a documented rebuild-from-backup procedure with a measured recovery time. A second production VPS as a warm standby is an option priced in §11 Q18, not a launch requirement.

- Database backups are self-operated and are not covered by any DreamHost backup product. Nightly `pg_dump --format=custom` pushed off-box to DreamObjects with 30-day retention; weekly dumps retained 1 year; continuous WAL archiving for point-in-time recovery. **A restore drill against a clean VPS is a Phase 0 exit criterion and repeats monthly thereafter.** A backup that has never been restored is not a backup.

- Error monitoring (Sentry) with on-call alerting to a designated email/SMS; runbook documented for the top 10 expected alerts.

### Scalability

- MVP designed for 5,000 approved members with 1,000 concurrent sessions. The recommended Stack 16 instance covers this comfortably for a read-dominant workload. The scaling path without structural change is: vertical upgrade to Stack 32, then separate PostgreSQL onto its own VPS, then add a read replica. Each step is a configuration change, not an application change, provided the database connection is addressed by environment variable from day one.

- Object storage has no practical cap at this scale. VPS disk does: 250 GB on Stack 16, shared between the OS, the application, and the PostgreSQL data directory. Disk utilisation is a monitored alert with a threshold at 70%, because a full disk on a co-resident database is an unrecoverable-until-manual outage.

### Browser and device support

| **Category** | **Supported** | **Notes** |
| --- | --- | --- |
| Chrome | Last 2 major versions | Includes Chrome on Android |
| Safari | Last 2 major versions | Includes iOS Safari 15.4+ |
| Firefox | Last 2 major versions |  |
| Edge | Last 2 major versions |  |
| Mobile screen sizes | 360×640 and up | Primary design target |
| Tablet | 768×1024 and up | Primary design target |
| Desktop | 1280 and up | Primary design target |

Legacy Internet Explorer and pre-Chromium Edge are not supported. A graceful message page is shown to detected IE clients.

# 9. Integrations

| **System** | **Purpose** | **Notes** |
| --- | --- | --- |
| WordPress (amend.us) | Blog sidebar feed | Server-side fetch via REST API every 15 minutes; cached. See §5.8. |
| Postmark | Transactional email | All lifecycle email (invite, approval, reset, notifications, reminders). |
| DreamObjects | Private file storage | S3-compatible. Resource library files, uploaded avatars, forum image attachments, and off-box database backups. Access via signed URLs only. |
| DreamHost Self-Managed VPS | Application and database hosting | Ubuntu 24.04 LTS, full root, Docker available. Production plus a smaller staging instance. |
| PostHog (EU Cloud or self-hosted) | Product analytics | Event-based, PII-free. See §6. |
| Sentry | Error monitoring + performance | Nonprofit discount; PII scrubbing enabled. |
| Cloudflare DNS + WAF | DNS and edge protection for network.amend.us | Rate limiting, bot protection, DDoS mitigation. |
| 1Password Secrets Automation (or Doppler) | Secrets management | Rotation-ready; no secrets in Git. |
| GitHub Actions | CI / CD | Lint, unit tests, type check, a11y scan, Lighthouse budget gate, then SSH deploy to staging and gated promotion to production. |
| ICS generation library | Calendar interop | For event .ics downloads and email invites. |
| TOTP authenticator apps | Admin MFA | Standards-compliant TOTP - Google Authenticator, 1Password, Authy, etc. |

No integration is required with any Amend or DOC internal system at launch. If single sign-on, HRIS provisioning, or DOC data lookups become requirements in a later phase, they are additive rather than restructuring.

# 10. Launch Constraints & Timeline

### Hard deadline

End of August 2026 - approximately 19 weeks from the date of this document. The phased plan below is sized to de-risk that deadline by front-loading foundational work and reserving the final 6 weeks for forum, analytics surfacing, accessibility remediation, and user acceptance testing.

### Phased delivery plan

| **Phase** | **Window** | **Scope** | **Exit criteria** |
| --- | --- | --- | --- |
| Phase 0 - Foundation | 4 wks | **Infrastructure provisioning and hardening (VPS, nginx, TLS, PostgreSQL with RLS, DreamObjects bucket, firewall, fail2ban, backup jobs, deploy pipeline)**, project setup, design tokens, base UI kit, auth, RBAC skeleton, database schema, registration + invitation + approval flows, audit-log foundation. | A Pathways member can be invited, register, be approved, log in, and see an empty dashboard. Security audit log writes on every auth event. CI/CD green. **Restore drill #1 completed against a clean VPS with a measured recovery time.** Operations runbook exists in draft. |
| Phase 1 - MVP core | May 16 – Jul 15 (8 wks) | Resource library, event calendar + RSVP, announcement banners, member directory, WordPress sidebar feed, admin content-management UIs, full audit logging for content events, PostHog wired up. | A member from each cohort can exercise every content-read and content-interaction feature end-to-end on mobile and desktop. Admins can manage all content types. |
| Phase 2 - Engagement + polish | Jul 16 – Aug 31 (6 wks + 3 days buffer) | Forum (threads, posts, flagging, moderation), admin analytics dashboard, full-platform accessibility remediation, pen-test-lite security review, content migration (resources, events, members from cohort lists), UAT with both cohorts, production launch. | 99.5% uptime on staging for 14 consecutive days, all Sev-1/Sev-2 UAT findings resolved, accessibility audit passing at AA, sign-off from both program leads. |

### Phase 3 - Post-launch (September 2026 onward)

- Third-party penetration test.

- Weekly digest emails and richer notification preferences.

- Peer-to-peer direct messaging (if cohorts ask for it).

- Semantic search across resources and forum posts.

- Cohort / working-group sub-spaces within a program role.

- Optional SSO with amend.us if the WP rebuild exposes an identity provider.

### Scope reduction options if the deadline comes under pressure

If Phase 2 velocity underruns plan, the following features can be moved to Phase 3 without blocking launch. They are ordered by how comfortably they can be deferred - first to last:

- Forum advanced moderation (suspension of posting, bulk hide). Launch with flagging + hide + delete only.

- Analytics dashboard beyond top-line cards. Launch with KPI cards only; funnels and leaderboards Phase 3.

- Event waitlisting. Launch with RSVPs and an 'event full' state only.

- Directory field-level privacy toggles. Launch with a single overall opt-in toggle; field-level in Phase 3. (Program leads should weigh in - this trade-off has privacy implications.)

- Weekly digest and @-mentions in forum. Per-thread subscriptions stay in MVP.

| **[RECOMMENDATION]** The forum (§5.7) is the single largest item on the critical path and carries the highest compliance stakes. Do NOT defer the forum itself - deferring forum means deferring most of the 'community' promise - but DO keep its moderation surface minimal at launch and plan a moderation v2 within 60 days. The community guidelines document needs to be drafted in Phase 0 so it's ready to publish on day one. |
| --- |

# 11. Open Questions & Assumptions

### Open questions for client clarification

These should be resolved in the first two weeks of Phase 0 to avoid rework. Ordered roughly by urgency.

| **#** | **Question** | **Why it matters / impact if unresolved** |
| --- | --- | --- |
| 1 | Confirm subdomain: network.amend.us, or another? | DNS, TLS certificate request, email sender domain, and branding all anchor here. One-day fix if decided in week 1; disruptive if changed later. |
| 2 | Exact definition of the DOC field - agency name? facility? ID number? Free-text or controlled list? | Drives the registration form, encryption approach, directory privacy defaults, and compliance posture. [COMPLIANCE NOTE]. |
| 3 | Full Network Name dropdown list - Pathways and LEAD confirmed; are there others planned for launch? | Affects role model and the approval workflow. |
| 4 | Brand asset delivery date from the WordPress rebuild team | Latest usable delivery is mid-June 2026 to hold the timeline. |
| 5 | Moderation policy owner and draft timeline | Forum cannot launch without a published community guideline and moderation escalation path. |
| 6 | Email service provider preference (Postmark recommended; client may already have one) | Drives integration credentials and deliverability setup. |
| 7 | Any existing DOC-facing or funder privacy commitments that affect retention or data residency? | May force specific retention windows or EU/US hosting decisions. |
| 8 | FERPA, HIPAA, or state-specific privacy regime applicability given the user base | If any apply, security controls and vendor agreements must be reviewed. Preliminary read: neither FERPA nor HIPAA applies directly, but state corrections-data regulations may. |
| 9 | Is there an existing membership list we can pre-load, or is Phase 1 a net-new invitation round? | Affects the invitation infrastructure volume and the approval queue sizing. |
| 10 | Multilingual requirements at launch? (English only assumed.) | If Spanish or other languages required, internationalization scaffolding is a Phase 0 item, not Phase 3. |
| 11 | Single Super Admin or named group? Any separation-of-duties requirement? | Affects the admin role model and MFA enrollment planning. |
| 12 | Default directory visibility: opt-in (recommended) or opt-out? | Material privacy decision for the LEAD cohort specifically. [COMPLIANCE NOTE]. |
| 13 | Acceptable data residency - US Cloud OK, or EU required? | Affects PostHog tier and DreamHost/DreamObjects region selection. DreamHost is US-based; an EU residency requirement would conflict with the hosting direction and must be resolved before Phase 0 provisioning. |
| 14 | Future SSO: is amend.us (WordPress) expected to become an identity provider? | If yes, design registration to be SSO-ready now; if no, carry on with credentials. |
| 15 | Is there a budget ceiling for monthly operational cost we should design toward? | Influences vendor-tier decisions. |
| 16 | Who signs off on the community guidelines and moderation policy? | Blocks forum launch. |
| 17 | Who is the named owner of OS patching, backup verification, and incident response after launch, and what is their availability? | Self-managed hosting moves these from a vendor to a person. Without a named owner with capacity, the §8 security and availability commitments are aspirational. Blocks the operations runbook sign-off. |
| 18 | Is a second production VPS (warm standby) within budget, or is single-node with restore-from-backup the accepted recovery model? | Determines worst-case outage duration. Single-node recovery is measured in hours; a standby reduces it to minutes at roughly the cost of one additional VPS. |
| 19 | What are the acceptable RTO and RPO for total database loss? | Drives WAL archiving frequency and whether streaming replication is required at launch. An RPO of 'last nightly dump' is materially different from 'last 60 seconds'. |
| 20 | Does the executive sponsor accept, in writing, that directing self-managed hosting transfers security patching, backup integrity, and incident response from a managed platform to Amend's technical lead? | This is a deliberate change in security posture for a platform holding data about corrections-affiliated individuals with a 7-year audit retention obligation. It should be a recorded decision, not an implicit one. See the accompanying ADR. |

### Assumptions this PRD makes (to be confirmed)

- Launch cohort size is in the hundreds to low thousands, not tens of thousands, per program.

- No integration with any Amend or DOC internal system is required at launch.

- The main amend.us WordPress site will expose a public REST API at /wp-json/wp/v2.

- Amend is a US-based nonprofit; US-region hosting is acceptable unless a client policy or funder agreement says otherwise. DreamHost is US-based, so this assumption is now load-bearing rather than incidental.

- Amend has, or will designate, a technical owner with the capacity and access to operate a Linux server after launch. If no such person exists, the self-managed hosting decision should be revisited before Phase 0 completes rather than after handover.

- English is the only supported language at launch.

- Payments, subscriptions, or monetization are out of scope. The platform is not a storefront.

- A designated Amend staff member can act as a day-to-day super admin and moderator from day one.

# 12. Appendix

## A. Data Model

Core entities and their most significant fields. Full schema to be finalized during Phase 0.

### A.1 Users and access

| **Entity** | **Key fields** |
| --- | --- |
| User | id (uuid), email (unique), password_hash, first_name, last_name, title, doc_affiliation (encrypted), network_id (FK), program_role (pathways │ lead │ none), admin_role (super_admin │ admin │ moderator │ none), status (pending │ active │ deactivated │ denied), mfa_secret (encrypted, nullable), mfa_enabled, directory_visible (bool), field_visibility (jsonb), created_at, updated_at, last_login_at |
| Network | id, name (e.g., 'Pathways to Change', 'LEAD'), program_role_mapping, created_at |
| Invitation | id, email, token (hashed), inviter_id (FK User), network_id (FK), first_name, last_name, title, doc_affiliation, status (pending │ accepted │ expired │ revoked), expires_at, created_at |
| Session | id, user_id (FK), token (hashed), user_agent, ip, created_at, last_seen_at, expires_at, revoked_at |
| PasswordResetToken | id, user_id (FK), token (hashed), expires_at, consumed_at |

### A.2 Content

| **Entity** | **Key fields** |
| --- | --- |
| Resource | id, title, preview_text, thumbnail_url, source_label, tags (text[]), file_object_key, file_size_bytes, file_mime_type, visibility (text[]: all_authenticated │ pathways │ lead), uploaded_by (FK User), created_at, updated_at, deleted_at (soft) |
| Event | id, title, description, starts_at (utc), ends_at (utc), timezone_hint, location, is_virtual, virtual_link, capacity (nullable), visibility (text[]), host_user_id, created_at, updated_at, cancelled_at |
| EventRSVP | id, event_id (FK), user_id (FK), status (yes │ no │ maybe │ waitlist), created_at |
| Announcement | id, headline, body (rich text), cta_primary_label, cta_primary_url, cta_secondary_label, cta_secondary_url, activates_at, expires_at, visibility (text[]), dismissible (bool), created_at, created_by |
| AnnouncementDismissal | user_id, announcement_id, dismissed_at |
| WpFeedEntry | id (wp post id), title, excerpt, featured_image_url, permalink, published_at, categories (text[]), fetched_at |

### A.3 Forum

| **Entity** | **Key fields** |
| --- | --- |
| ForumCategory | id, name, slug, description, visibility (text[]), display_order, created_at |
| ForumThread | id, category_id (FK), author_id (FK User), title, pinned (bool), locked (bool), created_at, last_post_at, hidden_at (soft), deleted_at (soft) |
| ForumPost | id, thread_id (FK), author_id (FK User), body_markdown, body_rendered, created_at, edited_at, hidden_at (soft), deleted_at (soft) |
| ForumFlag | id, post_id (FK), reporter_id (FK User), reason, status (open │ resolved_kept │ resolved_hidden │ resolved_deleted), resolver_id, resolved_at |
| ForumSubscription | user_id, thread_id, created_at |
| ForumSuspension | id, user_id (FK), actor_id (FK), reason, starts_at, ends_at, created_at |

### A.4 Audit and analytics

| **Entity** | **Key fields** |
| --- | --- |
| AuditLog | id, created_at, actor_user_id (nullable), actor_role, action, entity_type, entity_id, target_user_id (nullable), ip, user_agent, metadata (jsonb), severity |
| DirectoryProfileView (sampled) | id, viewer_id, viewed_id, created_at - used for directory_profile_viewed events when sampled |

### A.5 Key relationships

- User → Network: many-to-one; the network determines the default program role at approval.

- User → RSVPs, Posts, Threads, Flags: one-to-many from User.

- Content entities → visibility: denormalized text[] of role tokens. Indexed with GIN for fast intersection queries.

- ForumCategory → ForumThread → ForumPost: tree, two levels only (no nested replies at launch - flat post list within a thread).

- AuditLog is intentionally not joined to any entity with a foreign key; it references by ID strings so that deleted entities do not break the audit trail.

## B. Sitemap and Navigation Structure

### B.1 Public (unauthenticated)

- / - landing: redirects to /app if authenticated, otherwise shows a small marketing block with 'Sign in' and 'Request access' CTAs.

- /login

- /register - self-registration form

- /forgot-password

- /reset-password?token=... - consumes reset token

- /invite/[token] - consumes invite token, opens pre-filled registration

- /privacy - published privacy notice

- /community-guidelines - published forum guidelines

### B.2 Member app (authenticated)

- /app - dashboard: active announcement banners, upcoming events (my role), recent resources (my role), recent forum activity (my role), WP sidebar feed.

- /app/pending - holding page for users in Pending status.

- /app/resources, /app/resources/[id]

- /app/events, /app/events/[id]

- /app/directory, /app/directory/[user_id]

- /app/forum, /app/forum/c/[slug], /app/forum/t/[id]

- /app/profile - view own profile

- /app/profile/edit - edit profile fields

- /app/profile/privacy - directory opt-in and field-level visibility

- /app/profile/sessions - active sessions with revoke

- /app/profile/my-data - download or request deletion

### B.3 Admin app

- /admin - admin dashboard: top-line KPI cards, pending approvals count, open flag count.

- /admin/users, /admin/users/pending, /admin/users/[id], /admin/users/invite

- /admin/resources, /admin/resources/new, /admin/resources/[id]

- /admin/events, /admin/events/new, /admin/events/[id]

- /admin/announcements, /admin/announcements/new, /admin/announcements/[id]

- /admin/forum - categories and moderation

- /admin/forum/flags - open flag queue

- /admin/analytics - KPIs, funnels, leaderboards

- /admin/audit-log - viewer (export is Super Admin only)

- /admin/settings - system configuration (Super Admin only)

### B.4 Primary navigation (authenticated member)

Bottom bar on mobile; left sidebar on desktop.

- Home (/app)

- Resources (/app/resources)

- Events (/app/events)

- Forum (/app/forum)

- Directory (/app/directory)

- Profile menu - overflow on mobile, avatar dropdown on desktop

### B.5 Primary navigation (admin overlay)

Admins see an 'Admin' link in their profile menu that expands an admin sidebar alongside the member experience. Admins are never forced to choose between a 'member view' and an 'admin view' - both are available, with the member-facing routes reflecting their own role and the admin routes respecting their admin role.

Page 1 of 2