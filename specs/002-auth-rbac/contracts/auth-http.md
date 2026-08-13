# HTTP & page contracts — auth / RBAC

Base URL is environment-defined. All JSON errors for failed auth use **one** generic message body (no account existence or status). CSRF required on every POST.

Unauthenticated HTML routes below are public. `/app/*` and `/admin/*` require a session (layer 1). Data routes also call `requireRole` (layer 2).

## Pages (HTML)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/login` | none | Sign-in form. No remember-me control. |
| GET | `/forgot-password` | none | Request reset. Always shows success after POST. |
| GET | `/reset-password` | none | Token query param. |
| GET | `/mfa/enroll` | session, admin_role ≠ none, mfa_enabled=false | TOTP enrollment |
| GET | `/mfa/challenge` | session, admin_role ≠ none, mfa_enabled=true, mfa_satisfied=false | Challenge |
| GET | `/app` | session, status=active | Member home (minimal) |
| GET | `/app/pending` | session, status=pending | Holding page only |
| GET | `/app/profile/sessions` | session, status=active | List + revoke |
| GET | `/admin` | session, admin_role ≠ none, mfa_satisfied | Admin placeholder |
| GET | `/admin/audit-log` | session, admin ∈ {admin, super_admin}, mfa_satisfied | Paginated read (no export) |

Redirects: no session on `/app/*` or `/admin/*` → `/login`. Pending user on other `/app/*` → `/app/pending`. Admin without MFA satisfied on `/admin/*` → enroll or challenge.

Log-out control is present on every authenticated layout.

## Mutations

| Action | Input | Success | Failure |
| --- | --- | --- | --- |
| Sign in | email, password | Session cookie set; redirect by status/role/MFA | Generic failure; possible lockout; `login_failure` audit |
| Sign out | CSRF | Session row revoked; cookie cleared; `logout` audit | — |
| Request reset | email | Always success UX | Unknown email: distinct audit only |
| Complete reset | token, new password (≥12) | Password updated; all sessions revoked | Invalid/expired/consumed token |
| Enroll MFA | TOTP code | `mfa_enabled`; session `mfa_satisfied`; `mfa_enrolled` | `mfa_challenge_failed` |
| Challenge MFA | TOTP code | session `mfa_satisfied` | `mfa_challenge_failed` |
| Revoke session | session id (must own) | `revoked_at` set; `session_revoked` | Not found / not owner |

Auth.js route handler remains at `/api/auth/*` for CSRF and credential callback. Application code must not accept role fields from the client.

## Generic auth failure copy

Single string for: wrong password, unknown email, denied, deactivated, lockout. Pending + correct password is **not** this path (holding page).
