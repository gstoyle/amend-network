# Audit event contract

Writer: `lib/audit/write(tx, event)`. Must run in the **same transaction** as the mutating statement. `metadata` MUST NOT contain email, names, passwords, TOTP secrets, or reset tokens.

## Row shape

See [data-model.md](../data-model.md) `AuditLog`. `severity`: `info` | `warning` | `security`.

## Actions this slice MUST emit

| action | severity | actor_user_id | notes |
| --- | --- | --- | --- |
| login_success | info | set | |
| login_failure | warning or security | nullable | unknown email → null actor |
| password_reset_requested | info | nullable | unknown email → distinct metadata flag `unknown: true`, still same user-visible UX |
| password_reset_completed | security | set | |
| mfa_enrolled | security | set | |
| mfa_challenge_failed | security | set | |
| session_revoked | info | set | entity_id = session id |
| logout | info | set | |

Lockout additionally writes `login_failure` (or the same action) at **security** severity when the 10th failure triggers lock.

## Actions accepted but not emitted here

Full PRD §6 list remains valid on the `action` check constraint (lifecycle, content, forum, directory, admin). Later slices emit them without migrating `audit_log`.

## Read

| Role | Window |
| --- | --- |
| super_admin | full |
| admin | last 90 days |
| others | deny |

Export CSV is out of scope.
