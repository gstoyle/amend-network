# Data Model: Authenticated App Shell

**Feature**: `011-app-shell` | **Date**: 2026-08-18

**No persisted entities.** No table, column, index, migration, RLS policy, audit action, or analytics event. This document describes the two in-memory view models the shell consumes and the rules that derive them, so they can be tested as pure functions.

## Existing inputs

### `SessionClaims` (from `002`, unchanged)

| Field used | Role in this slice |
| --- | --- |
| `userId` | Key for the identity read |
| `programRole` | Displayed in the identity block; may gate a destination |
| `adminRole` | Decides whether administrative destinations exist at all |
| `status` | `pending` collapses the shell to its minimal frame |
| `mfaSatisfied` | **Not** used to hide administrative destinations — see below |

The shell reads these and nothing else. It never accepts a role from a prop, a query parameter, a cookie, or a form field.

**On `mfaSatisfied`**: an administrative destination stays visible to a session holding an administrative role that has not yet satisfied MFA. The existing challenge in `app/(admin)/layout.tsx` handles it on navigation. Hiding it instead would make the entry flicker in and out across a session and would imply navigation is the enforcement point, which FR-010 forbids.

### `x-pathname` request header (from `002` middleware, unchanged)

Set by `middleware.ts` for `/app` and `/admin` paths. The shell reads it to decide the current section. Absent header means no entry is current, which is a safe default rather than an error.

## View model: `Destination`

Produced by `lib/nav/destinations.ts`, consumed as props by chrome components.

| Field | Type | Meaning |
| --- | --- | --- |
| `href` | string | Absolute in-app path. MUST correspond to a route that exists |
| `label` | string | Visible text. Never replaced by the icon (FR-023) |
| `iconKey` | enum | Selects a glyph from the fixed inline set. Presentational only |
| `match` | `"exact" \| "prefix"` | How `isCurrent` compares against the current path |
| `group` | `"member" \| "admin" \| "account"` | Which region of chrome renders it |

**Validation rules**

- `href` MUST be non-empty and begin with `/`.
- No two destinations in one list may share an `href`.
- A destination whose route does not exist MUST NOT be emitted. Forum is the live example (spec Assumptions).
- The list MUST be stable for a given `SessionClaims` — same input, same output, same order.

## View model: `ShellIdentity`

Produced by `lib/profile/identity.ts`.

| Field | Type | Meaning |
| --- | --- | --- |
| `displayName` | string | The signed-in person's own name, decrypted for their own session only |
| `initials` | string | Derived from the name for the compact mobile avatar |
| `programRoleLabel` | string | Human-readable program role |

**Rules**

- Read through `withRls` with the caller's own `userId`. Never a broader read.
- FR-018 caps the shape: no email, no DOC affiliation, no title. Those columns are not selected.
- An empty or anonymized name (a retention-anonymized account, per `010`) MUST render a neutral fallback rather than an empty block or a crash.
- Not governed by the `007` directory privacy flags, which control what *other* members see (spec Assumptions).

## Derivation rules

### Which destinations a session gets

| Session | Member group | Admin group | Account group |
| --- | --- | --- | --- |
| `status = pending` | none | none | sign out only |
| `status = active`, `adminRole = none` | all built member destinations | **absent** | privacy, sessions, sign out |
| `status = active`, `adminRole ≠ none` | all built member destinations | administrative destinations | privacy, sessions, sign out, admin entry |
| `status` other than `active` or `pending` | none | none | sign out only |

"Absent" means not present in the returned list, therefore not in the rendered output. Not disabled, not hidden with CSS, not rendered and refused. SC-004 counts occurrences in rendered output and expects zero.

### Which entry is current

Given current path `p` and destination `d`:

- `d.match === "exact"` → current when `p === d.href`
- `d.match === "prefix"` → current when `p === d.href` or `p` starts with `` d.href + "/" ``

Home (`/app`) uses `exact`; every other destination uses `prefix`, which is what makes a detail page mark its parent section (FR-004).

At most one entry per rendered list may be current. Where two could match, the longest `href` wins. SC-005 asserts exactly one.

## What this slice explicitly does not model

- No preference, no dismissal state, no collapsed-sidebar memory, no last-visited tracking. Nothing about the shell is persisted per user.
- No navigation counts or badges. Those would need reads the shell does not perform.
- No forum destination until that route exists.
