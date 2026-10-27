# Research: Programme Cohorts

## 1. Constitution amendment (Principle I)

**Decision**: Propose MINOR amendment 1.0.0 → 1.1.0, replacing the vocabulary sentence with:

> Content entities MUST use a `visibility` text[] whose tokens are `all_authenticated`, a program token (`pathways | lead`), or a cohort token `cohort:<uuid>` naming an existing cohort. A user sees an entity if and only if any of their tokens intersects that set. A user's tokens are derived server-side from the signed session and cohort memberships, never from the client. The column MUST be GIN-indexed.
>
> Administrative role is a separate claim from program role. A user has one primary program role, may hold additional program memberships through cohorts, and has zero or one administrative role.

**Rationale**: Semantics (intersection, server-derived tokens, RLS backstop) are unchanged; existing compliant code stays compliant, so MINOR, not MAJOR. Records the dual-membership drift from 2026-09-14.

**Alternatives considered**: New `ProgramRole` value per cohort (enum churn per trip, breaks programme access); separate `cohort_ids uuid[]` column on each content table (two intersection paths, two indexes, every policy edited).

**Approval**: Technical lead. Implementation tasks are blocked until approved.

## 2. Token format

**Decision**: `cohort:<uuid>` using `networks.id`.

**Rationale**: Renames don't touch content. UUID is opaque in analytics. The `cohort:` prefix can't collide with existing tokens.

**Alternatives**: slug (breaks on rename); bare uuid (ambiguous in logs and checks).

## 3. Database token derivation

**Decision**: Extend `app_role_tokens()` to append `'cohort:' || un.network_id` for each `user_networks` row of `app.user_id` (via a SECURITY DEFINER helper beside `app_member_program_roles()`), and every cohort token when `app.admin_role = 'moderator'`. Admin and Super Admin keep their existing policy bypass.

**Rationale**: Every content policy already calls `visibility && app_role_tokens()`; no policy text changes. Memberships are read live, so add/remove takes effect on the next request without a session refresh.

## 4. Format check on content tables

**Decision**: Replace each `visibility <@ ARRAY[...]` CHECK with `visibility_tokens_valid(visibility)`, an IMMUTABLE function accepting the three fixed tokens or `^cohort:[0-9a-f-]{36}$`. Forum categories keep a separate rule forbidding `all_authenticated`.

**Rationale**: Arrays can't carry foreign keys. Existence and "not archived for new targets" are checked in the app inside the write transaction. A dangling cohort token fails closed: it matches nobody except staff.

## 5. Application tokens and claims

**Decision**: Add `cohortIds: string[]` to `SessionClaims`, loaded in `loadSession`/`insertSession` from `user_networks` (all cohort ids for Moderator). `visibilityTokens()` appends `cohort:<id>`. Query-layer filters use these; RLS uses its own derivation.

## 6. Validation

**Decision**: One parser in `lib/db/visibility.ts`: Zod-parse tokens, dedupe, then `assertCohortTargets(tx, next, previous)`. Every cohort must exist; cohorts not already on the item must be active. The four content writers drop their local `VISIBILITY` constants.

## 7. Audience labels

**Decision**: `audienceLabel(visibility, cohortNames)`. Programme or *All members* wins when present. Otherwise list cohort names (`X only`, `X and Y`, `X, Y and 2 more`). Callers load a per-request name map with React `cache()`.

## 8. Directory cohorts

**Decision**: SECURITY DEFINER `directory_listing_cohorts(uuid[])` returns `(user_id, network_id)` pairs for listings the caller may see (`directory_listing_visible`), restricted to networks whose programme the caller can see. The app attaches cohort names and filters in memory (listing volume is small).

**Alternatives**: Exposing `user_networks` SELECT to peers (leaks memberships of unlisted users); denormalised cohort array on `directory_listings` (sync trigger burden).

## 8a. Admin group filter

**Decision**: One list per content type, filtered by an *audience set* computed for the chosen group. A cohort's set is `{all_authenticated, <its programme>, cohort:<id>}`. A programme's set is `{all_authenticated, <programme>, every cohort:<id> in that programme}`. The query filter is `visibility && set`. "Targeted only" uses `visibility @> ARRAY[token]` (cohort) or `visibility && {programme, its cohorts}` (programme). Both forms use the existing GIN index.

**Rationale**: "What will this group receive?" is the question staff are asking, and it matches the member-side rule exactly. Separate pages per group (the forum pattern) were rejected because one resource or event can target several groups, so it would appear in several places.

**Alternatives**: Group tabs (same duplication problem); client-side filtering (sends every item to the browser and duplicates the visibility rule in the client).

## 9. Primary cohort protection

**Decision**: App refuses removing `users.network_id`. A BEFORE DELETE trigger on `user_networks` raises if the row matches the user's `network_id`, unless it fires from the existing sync trigger (OLD network change).

## 10. Writes and RLS

**Decision**: Grant `amend_app` INSERT/UPDATE on `networks` and INSERT/DELETE on `user_networks`, with policies limited to `app.admin_role IN ('admin','super_admin')`. Membership insert additionally requires the target user's `program_role <> 'none'` via a definer helper. No DELETE on `networks`.
