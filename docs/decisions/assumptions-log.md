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

---

## Still fully open, not yet assumed or addressed

Q4 (brand asset delivery — confirm whether the mid-June 2026 target was
met), Q5/Q16 (moderation policy, blocks slice 8), Q6 (email provider),
Q7/Q8 (funder/regulatory privacy), Q9 (existing membership list),
Q10 (multilingual), Q11 (Super Admin structure), Q14 (future SSO),
Q15 (budget ceiling).

---

**Log maintained by:** solo developer, per constitution governance.

**Last updated:** 2026-08-13
