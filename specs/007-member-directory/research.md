# Research: Member Directory

**Feature**: `007-member-directory` | **Date**: 2026-08-17

All Technical Context unknowns are resolved below. Stack and authorization are inherited from `002-auth-rbac` / `003`. Field-level toggles are in-scope (spec: do not take PRD §11 deferral). Clarifications 2026-08-17: hidden fields excluded from search matching; uniform hide (not per-viewer).

## 1. Do not widen `users` SELECT

**Decision**: Keep current `users_select` (credential lookup, own row, Admin/Super Admin). **Moderator and members still cannot SELECT other `users` rows.** Directory reads use projection tables, not `users`.

Today `users_select` would leak every encrypted column (email, names, title, DOC id) to anyone who can see the row. Postgres RLS is row-level. Expanding it to “same program” would give every Pathways member ciphertext for peers who hid email/DOC/title.

Admin/Super Admin already SELECT all users for the approval queue. That pre-exists. Directory **layer 2** still strips hidden fields for staff (uniform hide). This slice does not add a staff directory that returns those columns from `users`.

**Rationale**: Constitution I + II. Layer 3 must hold if layer 2 is missed.

**Alternatives considered**:

- Widen `users_select` to same-program Active + opted-in — rejected; hidden-field ciphertext would ride along.
- Column privileges omitting `email_encrypted` — Prisma `SELECT *` and own-row profile would break.
- SECURITY DEFINER that returns decrypted plaintext — rejected; encryption key must not live in Postgres.

## 2. Projection tables so hidden ciphertext is absent

**Decision**:

| Table | When a row exists | What it holds |
| --- | --- | --- |
| `directory_listings` | Member opted in (listing on) and is Active Pathways or LEAD | `user_id`, denormalized `program_role` + `network_id`, **name** ciphertext (always visible when listed) |
| `directory_shown_titles` | Listing on **and** title shown | `title_encrypted` copy |
| `directory_shown_docs` | Listing on **and** DOC affiliation shown | `doc_affiliation_id_encrypted` copy |
| `directory_shown_emails` | Listing on **and** email shown | `email_encrypted` copy |

Privacy save (same transaction): upsert/delete these rows from the member’s own `users` ciphertext. Hide title → `DELETE` shown-titles (search cannot match; SELECT returns 0). Opt out → delete listing + all shown rows.

Flags of record stay on `users` (`directory_visible`, three booleans, `directory_privacy_set_at`) so own-row privacy UI does not need peer SELECT.

**Rationale**: A missing child row is the layer-3 expression of “hidden.” Matching a hidden value then blanking the field is forbidden (clarification).

**Alternatives considered**:

- One listings row with all optional ciphertexts always present — rejected; hide would still leak ciphertext to peers.
- JSONB `field_visibility` only, search on `users` — rejected with §1.

## 3. Search is decrypt-then-match in process

**Decision**: After RLS returns listing (+ optional shown) rows for this viewer, decrypt with existing `decryptPii`. Match case-insensitive substring on **visible** fields only: name (first, last, first+last), network **label** (join `networks` in process by id — `networks` SELECT is already shared vocabulary), title if shown-row present, current DOC **list label** if shown-row present. Email is never a search field.

Empty/whitespace query returns the full allowed listing set (still counts toward the 30/minute cap). Query max 200 characters; longer → reject without searching.

Launch scale is hundreds of opted-in members per program, not millions. No plaintext name index.

**Rationale**: AES-256-GCM ciphertext is not `ILIKE`-able. Blind indexes would be a new crypto design the spec does not require.

**Alternatives considered**:

- HMAC of normalized name for exact match only — does not meet substring search; extra leak surface.
- pg_trgm on plaintext — violates Constitution II.

## 4. Same-program via `directory_listing_visible`, not a `visibility[]` on people

**Decision**: Listings are people, not content. One function:

```text
directory_listing_visible(p_user_id uuid) → boolean
```

True iff a listing row exists for that id, the **users** row is `status = active` and `program_role ∈ {pathways, lead}`, **and** either:

- `app.admin_role ∈ {admin, super_admin, moderator}`, or
- `app.status = 'active'` and `app.program_role` equals the listing’s `program_role`

Pending → empty / non-active status → false. Staff with program `none` still see both programs via the admin_role branch (same idea as staff SELECT on events). `app_role_tokens()` is **unchanged**. Do **not** put `all_authenticated | pathways | lead` on the listing.

`SECURITY DEFINER` + `SET search_path = pg_catalog, public` so the inner `users` join does not re-enter `users` RLS. `REVOKE ALL FROM PUBLIC`; `GRANT EXECUTE TO amend_app`. Direct `EXECUTE` returns false for other-program / deactivated / missing (same as missing).

Deactivation / leaving `active` is **not** read-gate-only. See **§11**.

**Rationale**: Spec reuses three layers and program-role tokens. Admin with `program_role = none` has only `all_authenticated` in `app_role_tokens()` — a fake `visibility = {pathways}` on a person would hide them from that Admin on member queries. Staff OR is the same pattern as events.

**Alternatives considered**:

- `visibility[]` on listings using `app_role_tokens()` — rejected for staff-with-no-program.
- New `authMode = directory` that bypasses RLS — rejected; same class of leak as old auth_mode bugs.

## 5. Rate limit is not `auth_throttle`

**Decision**: New `directory_search_throttle` (`user_id` PK, `window_started_at`, `search_count`). Tumbling 60-second window, cap 30, own-row RLS only. Count **before** running search, including empty-query list loads. 31st: generic try-later, **0 result rows**, no existence leak. No audit row for the refused search (would aid scraping telemetry); analytics is not called.

Do not reuse `auth_throttle` (HMAC of email, 10/15min lockout, `authMode: throttle`).

**Rationale**: Spec FR-016. Different key, window, and failure mode.

**Alternatives considered**:

- Cloudflare-only limit — origin still needs a per-user cap; constitution: do not assume a capability `infra/` does not provide for local tests.
- Sliding log of timestamps — correct but heavier; tumbling satisfies SC-009 (31st in one minute).

## 6. Analytics and audit

**Decision**: Extend `lib/analytics/track.ts` with `directory_search` and `directory_profile_viewed`. Allowed extra key: `viewedUserId` (opaque uuid) on profile view only. Block query strings, names, emails, titles, DOC. Exhaustive switch updated.

Audit actions already exist. `directory_privacy_changed`: same transaction as listing/field write; metadata keys of **which** toggles changed (`listing`, `showTitle`, `showDocAffiliation`, `showEmail`) as booleans — not values of those fields. `directory_profile_viewed`: actor = viewer, `target_user_id` = viewed; only when viewer ≠ subject; one row per successful other-member view at launch (spec assumption vs PRD “sampled”).

**Rationale**: Constitution II; spec FR-017–FR-019.

## 7. Initials only; no avatar upload

**Decision**: Render initials on brand tokens from decrypted name. No file upload, no DreamObjects, no `users.avatar_*` column.

**Rationale**: Spec allows optional avatar; YAGNI without storage work. A later slice can add upload behind the existing `lib/storage/` wrapper.

## 8. `lib/directory/` is new

**Decision**: New helper folder. Extending `lib/auth` or `lib/registration` would mix peer-directory reads into join/session code.

**Rationale**: AGENTS.md: prefer extend; new file allowed when extension is not possible. Same justification as `lib/events/`.

## 9. Q2 / Q12

**Decision**: Proceed on assumptions-log. Directory shows/searches the **current** `doc_affiliations.label` when the shown-doc row exists. Default listing off. **Unconfirmed by Amend.** If Q2 becomes free text, drop the label join and decrypt a text column instead. If Q12 becomes opt-out, default `directory_visible = true` and skip the first-run “you are not listed” prompt copy.

## 10. Appear vs view (matrix)

**Decision**: **View directory** allow for Super Admin, Admin, Moderator, Pathways, LEAD; deny pending/invited. **Appear in directory** allow Pathways and LEAD (they may opt in); deny Super Admin / Admin / Moderator matrix personas (PRD N/A — staff-only accounts do not appear); deny pending/invited. A person who is both staff and Pathways is not a matrix persona; product rule remains: appear only with program role + opt-in.

## 11. Leaving `active` deletes listing + shown-field copies (not read-gate-only)

**What the plan would have done if left implicit:** Rows in `directory_listings`, `directory_shown_titles`, `directory_shown_docs`, and `directory_shown_emails` **persist**. Peers and staff see 0 of them only because `directory_listing_visible` requires `users.status = 'active'`. Opt-out already **deletes** children; deactivation did not.

**Facts from this codebase (not assumed):**

- There is **no** app deactivate helper. `account_deactivated` is an allowed audit action; nothing writes it from product code. Seed sets `deactivated@local` via `amend_owner`.
- `users_update_own` WITH CHECK forbids changing `status`. `users_update_admin` may move **pending → active|denied** only — not to `deactivated`, and not **active → pending**. A revert to pending is not possible through `amend_app` today; it would be owner/SQL or a future helper.
- Projection tables have **no FK** to `users`, so nothing cascades.
- Shown-field SELECT uses `directory_listing_visible(user_id)`, so a leftover email ciphertext copy is unread while status ≠ active — including by staff. It is still stored.

**Decision:** When `users.status` **leaves `active`** (to `deactivated`, `pending`, or `denied`), **delete** that user’s `directory_listings` row and all three shown-field rows, and set `directory_visible = false`. Do **not** clear `directory_show_title` / `directory_show_doc_affiliation` / `directory_show_email` (those are preferences for a later opt-in). `directory_listing_visible` remains the read gate (defense in depth) and MUST still return false if a row were somehow left behind.

Implement as an `AFTER UPDATE OF status ON users` trigger (function `SECURITY DEFINER`, `search_path = pg_catalog, public`) so cleanup runs for owner/SQL tests **and** a future deactivate helper. This slice does **not** add a deactivate UI. Reactivation (`account_reactivated` later) MUST NOT recreate listings; the member opts in again.

**Rationale:** Shown-field tables are extra copies of email/title/DOC ciphertext created only for peer directory reads. Spec FR-006 / SC-008: deactivated members are removed from results regardless of prior opt-in. A persist-only read gate would (1) keep those copies for 7-year-adjacent retention with no listing purpose, (2) **re-list immediately on reactivate** if `directory_visible` and the listing row were still true/present, (3) leak those copies if a later policy mistakenly SELECTs shown-field tables without calling `directory_listing_visible`. Relying on the read gate alone is not acceptable.

**Alternatives considered:**

- Read-gate only (leave rows) — rejected; see above.
- App-helper delete only, no trigger — rejected; this slice has no deactivate path, so owner/SQL and a later helper would skip cleanup.
- Also zero the three `directory_show_*` flags — rejected; opt-in-again can restore the last field choices; listing stays off until they opt in.
