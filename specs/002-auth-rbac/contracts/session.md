# Session claims contract

Source of truth is the `sessions` row joined to `users`. The cookie JWT may carry only `session_id`. `requireRole` **must** use this loaded snapshot, never a client header/body/query.

```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "programRole": "pathways | lead | none",
  "adminRole": "super_admin | admin | moderator | none",
  "status": "pending | active | deactivated | denied",
  "mfaEnabled": true,
  "mfaSatisfied": false,
  "expiresAt": "ISO-8601"
}
```

## Cookie

| Attribute | Value |
| --- | --- |
| httpOnly | true |
| Secure | true (local HTTPS or documented local exception) |
| SameSite | Lax |
| Max-Age / Expires | **unset** (browser-close) |
| Path | `/` |

## requireRole input

```ts
requireRole({
  program?: ProgramRole | ProgramRole[]
  admin?: AdminRole | AdminRole[]
  statuses?: Status[]     // default ['active']
  mfa?: boolean           // true on every /admin data path
})
```

Missing session or failed predicate: same unauthorized handling as an unknown user (no leak). Tests that verify this helper **must not mock it**.
