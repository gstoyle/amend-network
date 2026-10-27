# Quickstart: Programme Cohorts

## Prerequisites

- Local Postgres reachable with `DATABASE_URL` and `DATABASE_URL_MIGRATE`
- `pnpm db:migrate` then `pnpm prisma db seed`
- Seed adds cohorts *Norway Sept 26* and *Norway April 27* (GLE) plus local users in each (see `prisma/seed.ts`)

## Automated gates

```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:rls
pnpm test:a11y
pnpm build
```

Expected: the RLS-COH-* rows in [contracts/rls.md](./contracts/rls.md) and the matrix rows in [contracts/permission-matrix.md](./contracts/permission-matrix.md) pass.

## Manual walkthrough

1. Sign in as `admin@local` and open **Admin → Cohorts**. Create *UK Spring 27* under Global Learning Experiences. Open `/register` in a private window and confirm it's offered.
2. Archive *Norway Sept 26*. Confirm `/register` no longer offers it. Sign in as its seeded member and confirm Home still loads programme content.
3. Publish a resource to *Norway April 27* only. Its member sees it, labelled *Norway April 27 only*. The *Norway Sept 26* member and `lead@local` don't, and its direct URL returns not found for them.
4. On *Norway April 27* → Members, add the *Norway Sept 26* member by email. Reload as that member: the resource appears. Remove them: it disappears. Try removing their primary cohort: refused.
5. Create forum room *Norway April 27* targeting that cohort. A listed member of the cohort can post; a listed *UK Spring 27* member can't see it.
6. Open **Directory** as a GLE member. Cohort names show on each listing; filtering by *Norway April 27* narrows the list; LEAD cohorts aren't offered.
7. Open **Admin → Audit log** and confirm the six cohort actions appear with no names or emails in the metadata.
