# HTTP & page contracts — registration / invitation / approval

Base URL from env (`AUTH_URL`). CSRF on every POST (Next.js Server Actions / Auth.js origin check, same as `002-auth-rbac`). Zod at every input boundary. `requireRole` from the signed session on every `/admin/users/*` data path; `mfa_satisfied` already required by the admin layout.

Generic **visitor** copy for self-registration (success and duplicate/ineligible): one string in the spirit of “If this email is eligible, you will receive instructions.” Do not vary it by account state.

## Pages (HTML)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | none | If no session: Sign in + Request access. If session: redirect `/app` or `/app/pending`. |
| GET | `/register` | none | Self-registration. Network dropdown = launch networks. DOC = active list only (no free text). Password ≥ 12. |
| GET | `/invite/[token]` | none | Pre-filled name + network; email locked; password required; DOC select (pre-select if invite has an active id). If a session exists: do not complete; tell the visitor to sign out. |
| GET | `/admin/users/pending` | session, admin ∈ {admin, super_admin}, mfa_satisfied | Oldest-first pending queue; filter by requested network. |
| GET | `/admin/users/invite` | same | Manual invite, CSV upload, list unused/expired/revoked invites, revoke, re-issue. |
| GET | `/admin/users/affiliations` | same | DOC list: add, edit label, deactivate. |

Moderator and program members: those admin routes **deny** (no pending/invite/list PII). Unauthenticated `/admin/*` still redirects to `/login` (layer 1).

Pending queue row MUST show: name, title, email, DOC label (decrypted id → current label), requested network, submitted at, registration IP or “unavailable”. IP is never shown on member routes.

## Mutations

| Action | Actor | Input | Success | Failure |
| --- | --- | --- | --- | --- |
| Self-register | anonymous | FR-001 fields | User `pending`; confirmation email if **new** email; admin alert if new; visitor always sees generic copy | Validation (missing/inactive DOC); visitor still generic on duplicate email; no second confirmation |
| Complete invite | anonymous, no session | token, password, title if missing, DOC if missing/inactive | User `active` in invited program; token `accepted`; `invitation_accepted` + `role_assigned` | Consumed → PRD used-copy. Expired/revoked/unknown/tampered → generic unusable. Signed-in → refuse. Inactive pre-selected DOC → must choose active. |
| Manual invite | admin, super_admin | email, first, last, network | `pending` invitation; email with link + 14-day expiry; `invitation_sent` | Existing user or pending invite; unknown network |
| CSV invite | admin, super_admin | file, ≤ 500 data rows, exact headers | Each valid row as manual invite; `bulk_invite_sent` if ≥ 2 valid; error report of invalid rows | Oversize; bad header; see CSV errors below |
| Approve | admin, super_admin | user id, optional network override | `pending` → `active`; program role from network; welcome (or set-password if no password); `registration_approved` + `role_assigned` | Not pending (second admin); unauthorized |
| Deny | admin, super_admin | user id, optional reason | `pending` → `denied`; polite email with **no** reason; reason encrypted on user; `registration_denied` | Not pending; unauthorized |
| Revoke invite | admin, super_admin | invitation id | `pending` → `revoked`; link dead; `invitation_revoked` | Not pending |
| Re-issue invite | admin, super_admin | invitation id (expired or revoked) | New `pending` row + new token + email; old token stays dead; `invitation_sent` | Target still pending or already accepted |
| DOC add/edit/deactivate | admin, super_admin | label / id | List change; `system_setting_changed` | Unauthorized; duplicate label |
| Invitation sweep | operator/test | `now` | Expire + remind per [data-model.md](../data-model.md) | — |

Approve/deny MUST be conditional updates (`status = pending`); zero rows → “no longer pending.”

## CSV

Headers (exact): `email,first_name,last_name,network_name,title,doc_affiliation`.

Invalid row reasons (admin-visible): missing required field; malformed email; duplicate email in file; email already a user; email already has a `pending` invitation; unknown `network_name`; `doc_affiliation` missing or not an **active** list label. Valid rows still send.

## Public invite copy

- Consumed: “This invitation has already been used — please log in or request a password reset.”
- Expired / revoked / unknown / tampered: one generic “this invitation is not valid” (must not imply an account exists).

## Out of scope here

Sign-in, reset, MFA, `/app/pending` shell, audit-log viewer, full `/admin/users` roster, directory privacy.
