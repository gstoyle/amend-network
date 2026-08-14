# Research: Registration, Invitation & Approval

**Feature**: `003-registration-invitation-approval` | **Date**: 2026-08-14

All Technical Context unknowns are resolved below. Stack and authorization are inherited from `002-auth-rbac` unless noted. Q2 is a **recorded product assumption**, not an open technical unknown.

## 1. DOC affiliation: controlled list + encrypted association (Q2)

**Decision**: Table `doc_affiliations` holds shared vocabulary (`id`, unique `label`, `active`, timestamps). That table is **not** PII. A person’s selection is PII: `users.doc_affiliation_id_encrypted` and `invitations.doc_affiliation_id_encrypted` store AES-256-GCM of the affiliation **uuid string** via existing `encryptPii` / `decryptPii`. Admin UI and pending review decrypt in process, then join to the current label so **label edits apply to prior selections** (spec US1). Public forms SELECT only `active = true` rows. Deactivate sets `active = false`; no DELETE.

CSV `doc_affiliation` matches an **active** label (trim, case-insensitive). Store the matched id encrypted on the invitation.

**Rationale**: Spec FR-014 and constitution II require the person’s affiliation encrypted at rest. A plaintext FK on `users` would make a database dump reveal every member’s DOC. A denormalized encrypted **label** would break “edit label → prior selections show the new label.” Encrypting the id keeps the reference and the ciphertext.

**Alternatives considered**:

- Free-text column — rejected; Q2 assumption and spec require a controlled list.
- Plaintext `doc_affiliation_id` FK + RLS only — rejected; fails column-level encryption.
- Encrypt the label snapshot, no id — rejected; label edits would not propagate.

**Revisit**: If Amend rejects the controlled list, drop `doc_affiliations` and encrypt a free-text column instead (assumptions log Q2).

## 2. Invite tokens reuse password-reset hashing

**Decision**: Extract the existing SHA-256 token hash + `randomBytes` helper from `lib/auth/password-reset.ts` into `lib/crypto/token.ts` (extend crypto; both call sites use it). Invite tokens: 32 random bytes, hex-encoded (256 bits ≥ 128). Store only `token_hash`. Email the raw token once in `${AUTH_URL}/invite/${token}`. Never log it.

Lookup: `auth_mode = 'invite_lookup'` (same shape as `password_reset`), `findUnique` on `token_hash`. Completion and expiry checks happen in application code after that lookup.

**Rationale**: Spec says the same “store hashed, send raw once” pattern as reset tokens. 002 already implemented that. Duplicating hash helpers would drift.

**Alternatives considered**: HMAC with a dedicated key — unnecessary; SHA-256 of a 256-bit secret is enough. JWT invite tokens — not revocable/expirable as a row; rejected.

## 3. RLS: public join vs admin queue vs no self-activation

**Decision**: Keep `amend_app` + transaction GUCs. Extend `app.auth_mode` with `registration` and `invite_lookup`. Do **not** use `credential_lookup` for admin listing (too broad for this purpose). New/changed policies:

| Table / command | USING / WITH CHECK |
| --- | --- |
| `doc_affiliations` SELECT | `true` (vocabulary; not PII) |
| `doc_affiliations` INSERT/UPDATE | `app.admin_role ∈ {admin, super_admin}` |
| `doc_affiliations` DELETE | none (revoke DELETE from `amend_app`) |
| `invitations` SELECT/INSERT/UPDATE | admin/super_admin **or** `auth_mode = 'invite_lookup'` |
| `users` SELECT | own id **or** `credential_lookup` **or** admin/super_admin |
| `users` INSERT | `auth_mode = 'registration'` WITH CHECK: `status = pending`, `program_role = none`, `admin_role = none` **or** `auth_mode = 'invite_lookup'` WITH CHECK: `status = active`, `admin_role = none`, `program_role ∈ {pathways, lead}` |
| `users` UPDATE | own id **cannot** change `status`, `program_role`, `admin_role` **or** admin/super_admin may update pending rows to `active`/`denied` |

Public self-registration runs `withRls({ authMode: 'registration' })` with no `user_id`. Invite completion uses `invite_lookup` to read the token row, then INSERT the user and UPDATE the invitation in the same transaction.

**Rationale**: Today `users` has SELECT (own / credential_lookup) and UPDATE (own any column) but **no INSERT policy**, so `amend_app` cannot create users (seed uses `amend_owner`). Own-row UPDATE currently allows a pending user to set `status = active` if layer 2 is skipped. This slice must close that hole because approval is now a product path.

**Alternatives considered**: Migrator client for all joins — bypasses RLS (forbidden for runtime). SECURITY DEFINER functions — extra objects; GUC policies match 002.

## 4. Invitation status vs user status

**Decision**: Invitation `status` enum: `pending` | `accepted` | `expired` | `revoked` (PRD Appendix A). `pending` means unused, **not** a Pending user. Completing an invite creates `users.status = active` with the invited network’s program role. Self-registration creates `users.status = pending`. Partial unique index: one `pending` invitation per `email_lookup`.

**Rationale**: Spec assumption: §5.2 invitation AC wins over §3’s generic Invited → Pending bullet.

**Alternatives considered**: Name unused invites `unused` — extra rename vs PRD. Create a Pending user at invite send — rejected; invited token holders must not be able to sign in (FR-023).

## 5. CSV parsing

**Decision**: Add `csv-parse` and parse with `columns: true`, UTF-8, strip BOM, max **500** data rows. Required header: `email,first_name,last_name,network_name,title,doc_affiliation`. Validate **all** rows first into valid vs invalid; persist and email **only** valid rows; return an error report for invalid rows (admin-facing; may name existing member / bad network / bad DOC). Duplicate emails inside the file: first occurrence may be valid; later duplicates are invalid.

**Rationale**: Titles and names need quoted commas. A hand-rolled RFC4180 parser is easy to get wrong; the spec requires a usable error report. 500 is the spec assumption ceiling.

**Alternatives considered**: No library — rejected for quoted-field risk. All-or-nothing reject of the whole file — rejected; spec says resubmit **only** bad rows.

## 6. Email: extend `lib/email/transport.ts`

**Decision**: Extend the existing transport with a lifecycle sender (kind + `to` + non-PII template vars + link URLs). Kinds: invite, self-reg confirmation, admin pending alert, welcome, set-password, denial, invite expiring soon, invite expired. `EMAIL_TRANSPORT=json|smtp` unchanged. New env: `ADMIN_ALERT_EMAIL` (group alias). Invite and reset links still built from `AUTH_URL`. Denial email has **no** reason text. Applicant confirmation does not reveal whether the email was new.

**Rationale**: Constitution: prefer extending an existing helper. 002 already chose Nodemailer + json/smtp.

**Alternatives considered**: New `lib/email/lifecycle.ts` — unnecessary split. Postmark in this slice — rejected (Q6; local mailbox only).

## 7. New module `lib/registration/`

**Decision**: Join-flow server helpers live in `lib/registration/` (`register.ts`, `invite.ts`, `approve.ts`, `doc-affiliations.ts`, `csv.ts`, `sweep.ts`). Pages stay in App Router; forms in `components/` with no role logic.

**Why not extend `lib/auth/`**: `lib/auth/` is session, credentials, MFA, lockout, and password reset. CSV validation, DOC list CRUD, approval, and invite lifecycle are a different domain. Extending `lib/auth/` would mix join rules into the session module. Token **hashing** does extend `lib/crypto/` (see §2). Audit still uses `lib/audit/write.ts`. RLS still uses `lib/db/rls.ts` (extend the `authMode` union only).

## 8. Expiry sweep without production cron

**Decision**: `runInvitationSweep(now = new Date())` in `lib/registration/sweep.ts`: (1) pending invites with `expires_at <= now` → `expired`, email inviting admin, `invitation_expired` audit; (2) pending invites with reminder not sent and `expires_at - 3 days <= now < expires_at` → email invitee + inviter, set `expiry_reminder_sent_at`. Completion **also** rejects if `expires_at <= now` even if the sweep has not run. Tests pass a frozen `now`. Production systemd/cron wiring is **out of scope** (no DreamHost in this slice); export the function for later `infra/`.

**Rationale**: Spec US5; PRD background jobs are system cron. Local/CI must not depend on a host crontab.

**Alternatives considered**: Check expiry only at click — misses admin “invite expired” email. In-process `setInterval` — not how this app runs under systemd.

## 9. Audit actions for revoke / re-issue / bulk

**Decision**: Emit PRD actions: `invitation_sent` (every successful invite row), `bulk_invite_sent` when one admin action sends **two or more** invites (`metadata: { count }`, no emails), `invitation_accepted`, `invitation_expired`, `registration_submitted`, `registration_approved`, `registration_denied`, `role_assigned` (on approve and on invite completion), `system_setting_changed` (DOC list add/edit/deactivate, `metadata: { setting: "doc_affiliation", op }`).

Revoke is **not** in PRD §6. Add `invitation_revoked` to the application allow-list **and** the Postgres `action` check constraint (additive migration). Re-issue: revoke-or-leave old row unusable + new `invitation_sent`. Metadata: ids and counts only — no email, names, DOC, tokens, or denial prose.

**Rationale**: Spec FR-017 allows planning to map revoke. Inventing `invitation_expired` for revoke would lie. Additive check-constraint update is the same pattern 002 used to pre-load the PRD enum.

## 10. Denial reason vs audit PII

**Decision**: Optional deny reason is **not** copied into the applicant email. It is **not** stored in `audit_log.metadata` (free text can be PII). Store `users.denial_reason_encrypted` (nullable, AES-256-GCM). Audit row: `registration_denied` with `metadata: { has_reason: boolean }`. Admins read the reason by decrypting the user row (admin SELECT policy).

**Rationale**: Spec wants the reason off the user email and on the audit trail; constitution forbids PII in audit metadata. Encrypted column + audit pointer satisfies both.

**Alternatives considered**: Reason only in metadata — fails the PII denylist in spirit. Drop storing the reason — fails spec.

## 11. Unauthenticated landing

**Decision**: Change `/` so unauthenticated visitors see Sign in and Request access (`/register`) per PRD Appendix B.1, instead of an immediate redirect to `/login`. Authenticated visitors still redirect to `/app` or `/app/pending`.

**Rationale**: Spec assumption: `/register` is directly reachable; wire the CTA on the existing landing.

## 12. Signed-in invite completion

**Decision**: GET/POST `/invite/[token]` if a session exists: do not complete; tell the visitor to sign out and retry. Never attach the invited profile to a different signed-in user.

**Rationale**: Spec edge case.

## 13. Analytics

**Decision**: This slice does **not** add PostHog. Join paths must not call an analytics client. Audit writer already denylists `doc_affiliation`. Unit test: registration/invite/approve audit metadata keys stay outside the PII denylist. SC-009 is met by absence of an analytics SDK plus that denylist.

**Alternatives considered**: Stub PostHog now — YAGNI; later analytics slice owns the outbound assertion.
