# Job contract: `runRetentionJob`

Not an HTTP API. Same invocation family as `runInvitationSweep(now)` in `lib/registration/sweep.ts`.

## Function

```ts
runRetentionJob(now?: Date): Promise<RetentionJobResult>
```

Default `now = new Date()`. Tests **must** pass a frozen `Date`.

`RetentionJobResult` fields: `auditSecurityDeleted`, `auditOtherDeleted`, `analyticsDeleted`, `usersAnonymized`, `passwordResetTokensDeleted`, `invitationsDeleted` (all integers ≥ 0).

## Transaction and RLS

One `withRls({ adminRole: "admin", status: "active", authMode: "retention" }, tx => { ... })` covering all Postgres mutations **and** `writeAudit` for each class with count > 0. This is the **only** production `authMode: "retention"` call site; `tests/rls/retention-policies.test.ts` must fail if a second `lib/` / `app/` / `scripts/` literal appears.

Analytics port may run inside that transaction (memory) or immediately before commit; if the port throws, the transaction **aborts** (no trail row claiming a count that did not happen).

## Class order (deterministic)

1. Audit security (7 years)
2. Audit other (3 years, includes old `retention_purged`)
3. Analytics port (24 months)
4. Anonymize eligible deactivated users (3 years inactivity) including leftover directory/session/reset rows for **those** ids
5. Password-reset tokens expired or consumed (global leftover class)
6. Invitations expired or revoked (global leftover class)

Then `writeAudit` once per class with count > 0 (`retention_purged`, `info`, `metadata: { class, count }`).

Do not `track()` any PostHog event.

## Local CLI (optional)

`pnpm retention:run` → `tsx scripts/run-retention.ts` → `runRetentionJob()`. No flags required. No production scheduler.

## Forbidden

- `app/**/route.ts` that calls this job
- Query params or JSON body that supply a role
- DreamHost crontab in this slice
