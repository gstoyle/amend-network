# Assumptions Log

Recorded, named assumptions for PRD §11 open questions, per the
constitution's requirement: *"Where a requirement depends on an
unresolved question in PRD §11, the spec MUST state the dependency
explicitly and either stop or proceed on a named, recorded assumption.
Silent assumptions... are not acceptable."*

This is not a substitute for getting real answers from Amend. It exists
so development can continue without silently guessing, and so every
place in the codebase that depends on one of these can point back to a
single dated decision instead of an implicit one buried in code.

---

## Q1 — Subdomain

**Assumption:** `network.amend.us`. Low risk, already the working value
throughout the PRD and ADR-0001.

**Revisit:** Before Phase 0 DNS/TLS provisioning.

---

## Q3 — Network Name list

**Assumption:** Pathways to Change and LEAD only for launch.

**Revisit:** Before slice 2 ships.

---

## Q12 — Default directory visibility

**Assumption:** Opt-in, per PRD §5.6's own compliance note. Lowest risk
item in this log.

**Revisit:** PRD asks the LEAD program lead specifically confirm this.
Before slice 6 ships.

---

## Q2 — DOC affiliation field definition

**Updated 2026-08-13.** Original assumption (free-text, no controlled
list) superseded.

**Current assumption:** Structured, admin-managed controlled list, not
free text. A Super Admin or Admin maintains the list of valid DOC
affiliation values (add/edit/deactivate entries), similar in shape to
how Network Name is managed. Members select from this list at
registration rather than typing free text.

**This is a developer decision, not yet confirmed by Amend.** Treat as
still open. The PRD explicitly asks for client sign-off on this field's
definition — this entry records the working assumption, not a resolved
answer.

**What this adds vs. the original assumption:**
- An admin UI/data model for managing the controlled list itself.
- A migration from "free text column" to "foreign key against a list
  table" if any work had already started against the narrower version.
- Still encrypted at rest (Constitution II), still hidden from the
  directory by default pending Q12-style confirmation for this field
  specifically.

**Cost if wrong:** Moderate. Structured-with-admin-management is a
bigger lift than free text, so if Amend comes back wanting something
simpler, that's wasted build, not just an unused column. Chase the real
answer rather than let this sit as settled.

**Unblocks:** Slice 2 (registration) and slice 6 (directory).

**Revisit:** Still the highest-priority open question in the project.
Confirm with Amend before slice 2's registration form work goes far
enough that the list-management UI is expensive to change.

---

## Q13 — Data residency

**Assumption:** US-based hosting acceptable, matches ADR-0001.

**Cost if wrong:** High — not a config change, reopens the hosting
decision entirely.

**Revisit:** Before any production provisioning in `infra/`.

---

## Q20 — Executive sponsor's written acceptance of hosting risk transfer

**No assumption possible.** Requires the executive sponsor's signature,
not an engineering default.

**Status:** Development continues under ADR-0001. This is a launch
gate, not an MVP gate — surface it directly, don't let it arrive late.

---

## Same shape as Q20 — organizational, not defaultable

- **Q17** — Named owner for OS patching, backups, incident response.
- **Q18** — Warm standby VPS in budget, or single-node accepted.
- **Q19** — Acceptable RTO/RPO for total database loss.

---

## Design decisions on ambiguous (not §11-listed) requirements

Recorded here for the same reason as the §11 items — documented
judgment calls on things the PRD doesn't spell out, not silent
assumptions.

**Lockout scope (auth-rbac slice, US5).** The 10-failures/15-minutes
lockout counts password sign-in attempts only, keyed by email. Failed
MFA/TOTP challenges are not counted toward the same lockout — they
already require a valid session and already write their own
`mfa_challenge_failed` audit event. PRD §5.1 doesn't specify either way;
this is the narrower reading, chosen so repeated bad TOTP codes don't
also lock a user out of password sign-in.

**Accessibility testing method (auth-rbac slice, T067).** Axe-core ran
against server-rendered HTML in jsdom, not a running browser instance.
This is weaker than a full browser-based check (contrast and some
ARIA-timing issues can pass in jsdom but fail in a real browser).
Acceptable for this slice; flag for real browser-based a11y testing
(e.g. Playwright + axe) before the Phase 2 pre-launch accessibility
review.

**CTA click uniqueness (announcements slice, 2026-08-17).** Tracking is
unique-per-user-per-announcement, not unique-per-button. A user who
clicks both primary and secondary CTAs on one banner produces **one**
analytics event (whichever they clicked first). The `slot` value on
`announcement_cta_clicks` records only which button was first, not a
per-button breakdown. Repeat clicks still redirect if the banner is
eligible; they do not insert a second row or emit a second unique
event. There is no audit row for CTA clicks (impressions/clicks are
analytics, not audit). If per-button CTR is ever needed, the primary
key on `announcement_cta_clicks` must change from
`(user_id, announcement_id)` to include `slot`.

Basis: PRD v1.1 §2 Banner CTA CTR — “Unique CTA clicks ÷ unique
impressions, per active announcement” — read with spec SC-009 (unique
CTA click does not increase on repeat click for the same member and
announcement). That is a unique-member reading of the §2 CTR
definition, not unique-per-button.

**Leaderboard k-anonymity (admin-analytics slice, 2026-08-18).** The
admin dashboard leaderboards omit a live resource or uncancelled event
unless its count is at least **3** (`download_count` or Yes RSVPs).
Below-threshold items are left off the list entirely — not shown with
a zero, blank, or "<3" count — then the remaining rows are capped
at 10. KPI cards and funnel stage totals are not k-filtered. PRD §6
asks for top-10 downloads and most-attended events for content
planning and says the lists are “not for member-ranking”; it does not
set a numeric floor. k=3 is a typical k-anonymity convention, chosen
because a named event with one Yes on a passively viewed dashboard is
close to identifying a member in a small cohort (LEAD in particular).
That is a different exposure than an Admin opening that event’s RSVP
roster on purpose. **Unconfirmed by Amend.** Revisit if program leads
want a different k or no floor. See
`specs/009-admin-analytics/research.md` §6a.

**Primary navigation composition (app-shell slice, 2026-08-18).** Two
decisions, both because the PRD's own passages differ or outrun what
this phase has built.

*Forum is in primary navigation.* PRD Appendix §B.4 lists Forum
(`/app/forum`) among primary destinations. Slice `013-community-forum`
ships the route, so Forum sits between Events and Directory. Five
primary destinations still fit the bottom bar without overflow.

*The mobile bottom bar carries the built primary destinations, with no
overflow menu.* PRD §7 says "bottom bar for the primary 4 actions
(Home, Resources, Forum, Profile) with a hamburger for secondary
items"; PRD Appendix §B.4 lists six entries (Home, Resources, Events,
Forum, Directory, and a profile menu). Those two do not agree on the
count. Guide (`/app/guide`) is appended after Directory so every
approved member can open the in-app handbook from primary navigation.
That is a sixth primary destination. Account actions stay in the
account area. **Unconfirmed by Amend.** Revisit if the bottom bar
overflows at 360px. See `specs/011-app-shell/spec.md` Assumptions.

**Single light appearance, reversing the dark-mode decision (member page
layouts slice, 2026-08-19).** Slice `008-design-tokens` took the design's
opt-in dark appearance (a class the mockup only sets from a playground
toggle) and mapped it onto `prefers-color-scheme: dark`, recording "no
user-facing theme control" as an assumption. The consequence was that a
member on a dark-set device received a dark portal with no way to leave
it, which is what visual review surfaced. Amend chose a single light
appearance over both alternatives offered — following the operating
system with an override toggle, or defaulting light with a toggle. The
dark token overrides are therefore removed rather than left inert, and
no theme control ships. **Confirmed by Amend at review, 2026-08-19.**
Revisit if shared-device use in low-light settings turns out to need a
dark option; reinstating it is a token-file change plus a control, not a
component change. See `specs/012-member-page-layouts/spec.md` US5 and
`specs/008-design-tokens/research.md` §3 for the decision being reversed.

**The public-writing column is reserved; forum activity is live (community
forum slice, 2026-08-19).** The approved design's home page keeps a
column for public blog writing and a block for recent forum activity.
The blog is still PRD §5.8 and unimplemented, so that column stays a
labelled reserved panel. Forum activity now has a data source and
appears in the main column. **Confirmed by Amend at review for the
reserved blog column, 2026-08-19; forum block added with
`013-community-forum`.** See `specs/012-member-page-layouts/spec.md`
FR-021 and `specs/013-community-forum/spec.md` FR-015.

**Community guidelines are product rules, not a signed policy
(community forum slice, 2026-08-19).** PRD Q5/Q16 (who signs the
moderation policy) remains open. `/community-guidelines` publishes the
rules the product enforces: role-gated rooms, allowlisted markdown, a
15-minute edit window, rate limits, flagging, and staff hide / delete /
lock / pin. Escalation for harm stays with programme staff. **Unconfirmed
by Amend.** Revisit when Q5/Q16 is answered.

---

## Still fully open, not yet assumed or addressed

Q4 (brand asset delivery — confirm whether the mid-June 2026 target was
met), Q5/Q16 (moderation policy, blocks slice 8), Q6 (email provider),
Q7/Q8 (funder/regulatory privacy), Q9 (existing membership list),
Q10 (multilingual), Q11 (Super Admin structure), Q14 (future SSO),
Q15 (budget ceiling).

---

**Log maintained by:** solo developer, per constitution governance.

**Last updated:** 2026-08-19 (in-app member guide added to primary
navigation; Q5/Q16 still open)
