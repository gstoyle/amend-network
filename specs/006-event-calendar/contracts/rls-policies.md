# RLS policy contract (delta)

Runtime role remains `amend_app` (no `BYPASSRLS`). Migrator `amend_owner`. Transaction-local GUCs from `002`–`005` are **unchanged**. **No new `app.auth_mode` value.**

`app_role_tokens()` is **unchanged**.

`pnpm test:rls` sets GUCs and queries **without** `requireRole`.

## Shared visibility core (one function — do not duplicate)

Not cancelled + `visibility && app_role_tokens()` lives in **one** SQL function. Policies **call** this function. They MUST NOT paste those predicates again.

```sql
CREATE FUNCTION event_visible_core(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM events e
    WHERE e.id = p_event_id
      AND e.cancelled_at IS NULL
      AND e.visibility && app_role_tokens()
  );
$$;

REVOKE ALL ON FUNCTION event_visible_core(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_visible_core(uuid) TO amend_app;
```

`SECURITY DEFINER` is required so the inner `SELECT` does not re-enter events RLS (same stack-overflow lesson as `announcement_visible_core`). Session GUCs still drive `app_role_tokens()`. Direct `EXECUTE` MUST return false for cancelled and other-cohort ids (same as missing).

Join-link reveal (boolean only — **never** returns the URL):

```sql
CREATE FUNCTION event_join_revealed(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT event_visible_core(p_event_id)
     AND EXISTS (
       SELECT 1
       FROM event_rsvps r
       WHERE r.event_id = p_event_id
         AND r.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND r.status = 'yes'
     )
     AND EXISTS (
       SELECT 1
       FROM events e
       WHERE e.id = p_event_id
         AND now() >= e.starts_at - interval '1 hour'
         AND now() <= e.ends_at
     );
$$;
```

`event_join_revealed` **calls** `event_visible_core`. It MUST NOT paste cancelled / token predicates. Direct `EXECUTE` on a LEAD-only id as Pathways is false.

Capacity / waitlist / FIFO promotion are **not** policies (layer 2 + row lock).

## events (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- GIN index on `visibility`
- Index on `starts_at`
- Check: visibility subset of `{all_authenticated, pathways, lead}`, cardinality ≥ 1
- Check: `ends_at > starts_at`
- Check: `capacity IS NULL OR capacity >= 1`

| Command | USING / WITH CHECK |
| --- | --- |
| SELECT | `event_visible_core(id)` **OR** `app.admin_role IN ('admin','super_admin','moderator')` |
| INSERT | `app.admin_role IN ('admin','super_admin','moderator')` |
| UPDATE | `app.admin_role IN ('admin','super_admin','moderator')` |
| DELETE | none |

`GRANT SELECT, INSERT, UPDATE` on `events` to `amend_app`. `REVOKE DELETE, TRUNCATE`.

Staff SELECT includes cancelled rows. Member SELECT never does (`event_visible_core` requires `cancelled_at IS NULL`).

## event_join_links (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- PK `event_id` FK `events(id)` ON DELETE restrict
- Check: `url` is `http://` or `https://` (helper + DB check)

| Command | USING / WITH CHECK |
| --- | --- |
| SELECT | `event_join_revealed(event_id)` **OR** `app.admin_role IN ('admin','super_admin','moderator')` |
| INSERT / UPDATE | `app.admin_role IN ('admin','super_admin','moderator')` |
| DELETE | none |

`GRANT SELECT, INSERT, UPDATE`. `REVOKE DELETE, TRUNCATE`.

Members who can see the event but are Maybe / No / waitlist / Yes-too-early get **zero** join-link rows.

## event_rsvps (new)

- `ENABLE` + `FORCE ROW LEVEL SECURITY`
- PK `(user_id, event_id)`
- FK `event_id → events(id)` ON DELETE restrict
- Check: `status IN ('yes','no','maybe','waitlist')`

| Command | USING / WITH CHECK |
| --- | --- |
| SELECT | own `user_id` **OR** staff admin_role as above (staff may list RSVPs in admin) |
| INSERT | own `user_id` **AND** `event_visible_core(event_id)` |
| UPDATE | own `user_id` **AND** `event_visible_core(event_id)` |
| DELETE | none |

`GRANT SELECT, INSERT, UPDATE`. `REVOKE DELETE`. Repeat RSVP is UPDATE of the same PK, not a second row.

Waitlist promotion UPDATEs another user’s row. Member RLS only allows UPDATE of **own** RSVP, so promotion cannot be a plain Prisma update in the member session.

Use `SECURITY DEFINER` `event_promote_oldest_waitlist(p_event_id uuid) RETURNS uuid` owned by `amend_owner`:

- Signature is **exactly one argument** (`p_event_id`). There is no `user_id` parameter. The function MUST NOT accept a target user.
- `SET search_path = pg_catalog, public`
- Returns null unless `event_visible_core(p_event_id)` is true for the **caller’s** GUCs (other-cohort / cancelled → no-op, zero rows updated)
- Requires a free Yes seat (`capacity` IS NULL OR `count(status='yes') < capacity`). If no seat is free → return null, update 0 rows (must not promote anyway)
- Sets the oldest waitlist on **that** `p_event_id` only (`waitlisted_at` ASC, then `user_id` ASC as tie-break) to `yes`, clears `waitlisted_at`, returns that `user_id` (or null)
- Other events’ waitlists MUST be untouched
- `REVOKE ALL FROM PUBLIC`; `GRANT EXECUTE TO amend_app`

The RSVP helper calls this in the same transaction after a Yes seat frees. Helper-path tests are **not** sufficient for the assertions below.

### Direct EXECUTE `event_promote_oldest_waitlist` (required test file)

**File**: `tests/rls/event-promote-oldest-waitlist.test.ts`  
**How**: connect as `amend_app`, set session GUCs, run `SELECT event_promote_oldest_waitlist($1::uuid)`. Do **not** call `lib/events` RSVP helpers. Same class of verification as `announcement_dismissible` direct EXECUTE.

**Caller**: a Pathways member (`app.program_role = pathways`, `app.status = active`, `app.admin_role` empty / not staff). The caller’s `app.user_id` is **not** any waitlisted user on the fixture events (a third party).

**Fixtures** (seeded as owner, then queried as `amend_app`):

| Event | Visibility | Capacity | RSVPs |
| --- | --- | --- | --- |
| Same-cohort `E_path` | `{pathways}` | 1 | Yes: user Y. Waitlist oldest W1, newer W2 (`waitlisted_at` strictly earlier for W1). Unrelated event `E_other` (also Pathways, capacity 1) has waitlist W3 only, 0 Yes |
| Cross-cohort `E_lead` | `{lead}` | 1 | 0 Yes (seat free). Waitlist L1 (LEAD user). |

**Cases** (all with the third-party Pathways caller above):

1. **Oldest-only, no target user, that event only.** Confirm `pg_proc` for `event_promote_oldest_waitlist` has `pronargs = 1` (cannot pass a user id). Free the Yes seat on `E_path` (owner/setup: set Y to `no`) so one seat is free. `SELECT event_promote_oldest_waitlist(E_path)` returns W1’s uuid. W1 is `yes`; W2 remains `waitlist`; `E_other` W3 remains `waitlist`. A second call with a still-free seat (if W1 were still waitlisted — use a fresh fixture or promote once only) never lets the caller pick W2 over W1.

2. **Cross-cohort is a no-op.** Seat on `E_lead` is free. `SELECT event_promote_oldest_waitlist(E_lead)` returns SQL NULL. L1 still `waitlist`. Zero `event_rsvps` rows updated on `E_lead`.

3. **No free seat is a genuine no-op.** Restore `E_path` to capacity full (Y is `yes` again; W1 and W2 waitlisted). `SELECT event_promote_oldest_waitlist(E_path)` returns SQL NULL. W1 and W2 still `waitlist`. Zero rows updated. Must not silently promote.

These three cases are **fail-first** and MUST be their own `tasks.md` item pointing at this file. A line in this contract without that test file is not done.

## Extra assertions (required)

Application + RLS:

- Pathways: 0 rows for LEAD-only events; 0 join-link rows for a Yes RSVP more than 1h before start; 0 join-link rows for Maybe on a currently-in-window virtual event
- Pending: 0 event / rsvp / join-link rows
- Moderator: INSERT events allowed; INSERT announcements still denied (005 unchanged)
- Direct `EXECUTE event_visible_core(<lead-only-id>)` as Pathways → false
- Direct `EXECUTE event_join_revealed(<lead-only-id>)` as Pathways → false
- Direct `EXECUTE event_promote_oldest_waitlist` — **the three cases in the section above**, in `tests/rls/event-promote-oldest-waitlist.test.ts`, not only this bullet
- Cancelled event: member SELECT 0; staff SELECT 1
- Two concurrent Yes at capacity=1: one Yes, one waitlist
- `events.virtual_link` column MUST NOT exist
