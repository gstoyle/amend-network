# Quickstart: Member Page Layouts

**Slice**: `012-member-page-layouts` | **Spec**: [spec.md](./spec.md)

## Setup

```bash
docker compose up -d          # Postgres 16
pnpm install
pnpm db:migrate               # no new migration in this slice; confirms schema is current
pnpm db:seed
pnpm dev
```

Seeded sign-in addresses are in `prisma/seed.ts`. Sign in as a LEAD member and again as a
Pathways member — the audience markers and the visible item sets differ between them, and both
need checking.

If the dev server fails to start with `EPERM ... .next\trace`, a previous dev server still holds
the directory. Stop it, delete `.next`, and start again.

## Automated gates

```bash
pnpm test                     # unit + integration, includes the new derivation tests
pnpm test:rls                 # required: this slice touches content-table queries
pnpm test:a11y                # required: pages and interactive components changed
pnpm typecheck
pnpm lint
```

`pnpm test:rls` is not optional here. Extending the event list with RSVP state and an attendee
count touches content-table queries, so Principle IV requires the matrix to run with the
application bypassed and to produce results identical to before this slice.

## Manual inspection

Open `/app`, `/app/resources`, and `/app/events` beside the design reference. The mockup runs
separately:

```bash
cd mockup && pnpm install && pnpm dev
```

### Appearance

1. Set the operating system to a dark colour preference and reload. Every page must render in
   the light warm-stone appearance (SC-006).
2. Open the source selector on the library. Its popup, and the page scrollbars, must also be
   light — that is what `color-scheme: light` is for ([research.md](./research.md) §1).

### Framing

3. Each page opens with a category line, then one `<h1>`, then a short description.
4. Content left edges line up with the sidebar's content edge and match the mockup's inset. No
   page adds its own padding on top of the shell's (FR-004).
5. Section headers all share one rhythm: category line, `<h2>`, bottom rule, optional full-list
   link on the right.

### Library

6. At 1280px and wider, resources sit two to a row; below that, one (SC-002).
7. A card shows the format tile, source, title, description, tags, updated date, format and
   size, audience marker, and an enabled download action.
8. Type a search term, pick a source, tick two topics, press Apply. The count matches the number
   of cards shown (SC-007).
9. Filter down to nothing. The empty panel appears with a heading and a clear-filters action.
10. Clear filters disappears when no filter is active.

### Home

11. The greeting uses your first name under today's date, with the program-role badge beside the
    identity line.
12. Announcements render as support-toned bordered cards with their call to action and posted
    date. The dismiss control measures at least 44×44.
13. At `lg` and wider, events and resources fill the left eight columns and the reserved panel
    fills the right four. Below `lg` they stack with events first.
14. The reserved panel states that public writing is not yet available. It has no link and no
    placeholder rows (FR-021).

### Events

15. Each row leads with a month-and-day chip, then the full weekday, date, and time as text.
16. An event you have RSVP'd yes to shows a registration confirmation instead of a register
    control. One you have not shows the register link.
17. An event with a capacity shows remaining seats; one without shows no note.
18. An online event says so and shows no empty location.

### Accessibility

19. At 360px wide, no page scrolls horizontally (SC-003).
20. Tab through each page. Focus order follows visual order and every stop shows a visible ring
    (SC-008).
21. Enable a reduced-motion preference. Hover and state changes must not animate.
22. With a screen reader, confirm the reserved panel announces as a named region, the result
    count announces politely on change, and topic chips announce their checked state.

## What this slice does not change

Nothing about who can see what. If any item appears or disappears for a role compared with
before this slice, that is a defect, not a design outcome (FR-032, SC-010).
