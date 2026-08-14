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

Each entry: what was assumed, why, what it unblocks, how it gets
revisited, and how costly it is if the real answer differs.

---

## Q1 — Subdomain

**Assumption:** `network.amend.us`.

**Rationale:** Already the working value throughout the PRD and
ADR-0001. Low risk to proceed on.

**Unblocks:** DNS, TLS cert requests, email sender domain, branding.

**Cost if wrong:** Low if caught early (DNS/TLS re-provisioning before
launch). Disruptive if changed after go-live.

**Revisit:** Confirm with Amend before Phase 0 DNS/TLS provisioning
begins. Trivial to change now, expensive later.

---

## Q3 — Network Name list

**Assumption:** Pathways to Change and LEAD only for launch. No
additional networks.

**Rationale:** Stated MVP scope throughout the PRD. Architecture
already supports adding networks post-launch without structural
change (see PRD §4 decision criteria).

**Unblocks:** Registration form's network dropdown, role model.

**Cost if wrong:** Low. Adding a network later is additive, not a
redesign.

**Revisit:** Confirm before slice 2 (registration-invitation-approval)
ships.

---

## Q12 — Default directory visibility

**Assumption:** Opt-in. Presented as a single clear toggle during the
approval welcome flow.

**Rationale:** This is not really an assumption so much as
implementing what PRD §5.6's own [COMPLIANCE NOTE] already specifies.
Lowest-risk item in this log.

**Unblocks:** Slice 6 (member directory).

**Cost if wrong:** Low — this is the conservative default; an
opt-out requirement later would be a config change, not a redesign.

**Revisit:** PRD explicitly asks that the LEAD program lead confirm
this default specifically, given the sensitivity of that cohort.
Confirm before slice 6 ships, not just before launch.

---

## Q2 — DOC affiliation field definition

**Assumption:** Free-text field only (agency/facility description, no
controlled list, no DOC ID number). Encrypted at rest
(application-layer AES-256-GCM per Constitution II). Hidden from the
directory by default, not just opt-in like other fields.

**Rationale:** Deliberately the narrowest viable interpretation.
Under-building here (missing a controlled-list feature, missing an ID
field) is cheap to add later — an unused capability, not a liability.
Over-building here (collecting an ID number field that shouldn't
exist) is not cleanly reversible once it has held real data about
real corrections-affiliated individuals. Given the correctional-system
context, asymmetric risk justifies building narrow even though it may
mean rework.

**Unblocks:** Slice 2 (registration) and slice 6 (directory), both of
which depend on this field's shape.

**Cost if wrong:** Moderate-to-high. This is the one item in this log
where "modify once we have an MVP" doesn't fully apply if the real
answer requires *more* collection than assumed — that's a schema and
encryption-scope change touching data that may already be live.

**Revisit:** Do not treat this as settled by this log. Chase the real
answer from Amend in parallel with development, not after. This is the
single highest-priority open question for the project.

---

## Q13 — Data residency

**Assumption:** US-based hosting is acceptable.

**Rationale:** Matches what ADR-0001 already assumes and what's
already threaded through the stack (DreamHost, DreamObjects, PostHog
US/EU-optional).

**Unblocks:** Continuing infra work under the existing DreamHost
decision.

**Cost if wrong:** High, not low. Unlike most items here, an EU
requirement doesn't get "modified" at MVP — it reopens the hosting
decision in ADR-0001 entirely. Track this as an accepted risk being
carried forward, not a neutral placeholder.

**Revisit:** Before any production provisioning begins in `infra/`.
Confirm explicitly with Amend given the DreamHost hosting decision was
client-directed and would need to be client-reversed.

---

## Q20 — Executive sponsor's written acceptance of hosting risk transfer

**Assumption:** None. This cannot be defaulted — it requires a specific
person to sign something, not an engineering value to guess.

**Status:** Development continues against ADR-0001's architecture,
which is unaffected by whether this is signed yet. But this is not
closed out by proceeding — it is a **launch gate**, not an MVP gate.

**Unblocks:** Nothing engineering-wise. Blocks: comfortable go-live.

**Revisit:** Before Phase 2 exit / production launch. Surface directly
to the executive sponsor; do not let it arrive as a surprise at the
end of the timeline.

---

## Related open questions — same shape as Q20, not yet addressed here

These are organizational answers, not engineering defaults, and don't
belong in an assumptions log the same way the items above do. Listed
here only so they aren't lost:

- **Q17** — Named owner for OS patching, backup verification, and
  incident response post-launch. Blocks operations runbook sign-off
  (a Phase 2 exit criterion).
- **Q18** — Warm standby VPS in budget, or single-node
  restore-from-backup accepted as the recovery model.
- **Q19** — Acceptable RTO/RPO for total database loss. Drives whether
  streaming replication is needed before launch.

---

## Still fully open, not yet assumed or addressed

Q4 (brand asset delivery — check whether the mid-June 2026 target was
actually met), Q5/Q16 (moderation policy owner and sign-off, blocks
slice 8), Q6 (email provider), Q7/Q8 (funder/regulatory privacy
commitments), Q9 (existing membership list vs net-new), Q10
(multilingual), Q11 (Super Admin structure), Q14 (future SSO), Q15
(budget ceiling).

---

**Log maintained by:** solo developer, per constitution governance
(technical lead approval sufficient for recording assumptions; MAJOR
changes if an assumption here is later contradicted by a real answer
that requires rework of already-shipped code).

**Last updated:** 2026-08-13
