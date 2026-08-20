# Contract — navigation

Not an HTTP API. This is the contract between `lib/nav/destinations.ts` and the chrome components that render its output. Shapes are in [../data-model.md](../data-model.md).

## Member destinations

Emitted for `status = active`, in this order, regardless of administrative role.

| Label | href | match | Source |
| --- | --- | --- | --- |
| Home | `/app` | exact | PRD §B.4 |
| Resources | `/app/resources` | prefix | PRD §B.4 |
| Events | `/app/events` | prefix | PRD §B.4 |
| Directory | `/app/directory` | prefix | PRD §B.4 |

**Forum is absent.** PRD §B.4 lists it; the route does not exist in this phase. Recorded in `docs/decisions/assumptions-log.md`. Adding it later means one row here, not a shell change.

## Account destinations

Rendered in the account region — the sidebar footer at desktop, and reachable from the mobile top bar.

| Label | href | match | Condition |
| --- | --- | --- | --- |
| Directory privacy | `/app/profile/privacy` | prefix | `status = active` |
| Active sessions | `/app/profile/sessions` | prefix | `status = active` |
| Admin | `/admin` | prefix | `adminRole ≠ none` |
| Sign out | — | — | always; renders the existing logout control, not a link |

There is no `/app/profile` index route. The mockup's profile entry points at one; do not emit it.

## Administrative destinations

Emitted only when `adminRole ≠ none`. Rendered as a separate labelled group so member destinations stay reachable on administrative pages (PRD §B.5).

| Label | href | match |
| --- | --- | --- |
| Admin home | `/admin` | exact |
| Analytics | `/admin/analytics` | prefix |
| Audit log | `/admin/audit-log` | prefix |
| Resources | `/admin/resources` | prefix |
| Events | `/admin/events` | prefix |
| Announcements | `/admin/announcements` | prefix |
| Pending users | `/admin/users/pending` | prefix |
| Invite | `/admin/users/invite` | prefix |

Per-destination administrative-role narrowing (Moderator versus Admin versus Super Admin) follows whatever each route's own `requireRole` already enforces. Where a route denies a Moderator today, its destination MUST NOT be emitted for a Moderator. The single source of truth stays the route's own check; this list mirrors it and never widens it.

## Role rules

1. Roles come from `SessionClaims` only. A role supplied by the browser MUST NOT reach this module.
2. `adminRole = none` MUST produce zero administrative destinations. Not disabled, not CSS-hidden — absent from the returned array (FR-007, SC-004).
3. `status = pending` MUST produce zero member and zero administrative destinations; only sign out (FR-019).
4. `mfaSatisfied` MUST NOT affect the list. The admin layout's existing challenge handles it (see [../data-model.md](../data-model.md)).
5. Omitting a destination is presentation. Requesting the route directly MUST produce the same outcome as before this slice (FR-010, SC-007).

## Current-section rules

- `exact` matches the path exactly. `prefix` matches the path or the path plus `/`.
- `/app` is `exact`; everything else is `prefix`.
- Where more than one could match, the longest `href` wins; at most one entry per list is current (SC-005).
- The current entry carries `aria-current="page"` and a non-colour visual marker (FR-004, FR-005).
- A missing `x-pathname` header marks nothing current. This is not an error.

## Purity

`memberDestinations`, `adminDestinations`, and `accountDestinations` are synchronous and side-effect free: no database read, no `headers()` call, no `fetch`. They take claims and return an array. Current-section matching is a separate pure function taking a path and a list.

This is what lets `tests/unit/app-shell-nav.test.ts` prove role correctness without mocking `requireRole`, which Constitution Principle IV requires.
