# Quickstart: Registration, Invitation & Approval (local)

Proves this slice against **local** Postgres 16 and the json mailbox from `002-auth-rbac`. No DreamHost.

## Prerequisites

Same as [../../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm, Docker Postgres, `.env` from `.env.example`.

Additional env (names only): `ADMIN_ALERT_EMAIL` (group alias for pending alerts). `AUTH_URL` already used for reset links; invite links use it too.

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
```

Seed still includes the eight auth users. New: DOC fixtures `Test Agency A`, `Test Agency B` (active), `Test Agency Inactive` (deactivated). Password = `SEED_PASSWORD`.

## Automated validation

```bash
pnpm test          # includes app matrix; requireRole not mocked
pnpm test:rls      # pending-queue / invitations / affiliations as amend_app
pnpm test:a11y     # axe on /register, /invite/[token], pending, invite, affiliations
pnpm typecheck
pnpm lint
```

Expect: Super Admin and Admin **allow** approve/deny; Moderator and members **deny**; fail-closed unchanged for unbuilt capabilities; 0 free-text DOC fields on register/invite pages; mixed CSV sends only valid rows.

## Manual validation (optional)

```bash
pnpm dev
```

`EMAIL_TRANSPORT=json`: read captured files under `EMAIL_JSON_DIR` (never print tokens in app logs).

| Check | Expect |
| --- | --- |
| Signed out `/` | Sign in + Request access |
| `/register` with new email, active DOC, a launch network | Generic visitor copy; pending user; applicant + admin json mail; `/login` → holding page only |
| `/register` with `pathways@local` | Same generic copy; no extra confirmation that reveals the account |
| Admin MFA session → `/admin/users/pending` | Oldest first; approve → member can open `/app`; deny + reason → polite mail, no reason in mail |
| Moderator → pending / invite / affiliations | Denied |
| `/admin/users/affiliations` deactivate B | `/register` no longer lists B |
| Manual invite | Json mail with `/invite/{token}` and 14-day copy |
| Mixed CSV (one good, one unknown network) | One invite sent; error report names the bad row |
| Complete invite | Active member of invited network; second click = already used |
| Revoke unused invite | Link unusable |
| Frozen-clock sweep past 14 days | Status expired; admin notice |

## Contracts

- [registration-http.md](./contracts/registration-http.md)
- [rls-policies.md](./contracts/rls-policies.md)
- [audit-events.md](./contracts/audit-events.md)
- [permission-matrix.md](./contracts/permission-matrix.md)
- [data-model.md](./data-model.md)
