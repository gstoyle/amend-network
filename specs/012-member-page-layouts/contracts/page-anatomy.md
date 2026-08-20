# Contract: Page Anatomy

**Slice**: `012-member-page-layouts` | **Spec**: [spec.md](./spec.md)

Structural and accessibility obligations for each piece this slice builds. Reference design is
`mockup/`. Every value resolves through the `008` token set; literals are forbidden (FR-030).

Note on utility names: the theme ships `min-h-touch` / `min-w-touch` for the 44px minimum and
`h-tap` / `w-tap` for fixed tap-sized boxes. The design's `min-h-tap` does not exist here — that
spelling was already settled in `011` research §9.

---

## Shared framing

### Page header

Order is fixed: category line, then title, then optional description.

| Obligation | Requirement |
| --- | --- |
| Category line | `.eyebrow` on muted foreground. Never a heading element. |
| Title | Exactly one `<h1>` per page. |
| Description | Optional, muted, width-capped so it does not run the full column. |
| Landmark | Wrapped in `<header>`. |

### Section header

| Obligation | Requirement |
| --- | --- |
| Structure | Category line above an `<h2>`, with a bottom rule and an optional full-list link on the same row. |
| Naming | The `<h2>` carries an `id`, and its `<section>` references it with `aria-labelledby`. |
| Full-list link | At least 44px high, carries a trailing arrow glyph that is `aria-hidden`, and its text alone states the destination (FR-034). |
| Heading order | `<h2>` only. Cards inside use `<h3>`. No level is skipped. |

### Page padding

Page bodies MUST NOT carry an outer padding class. `<main>` in `components/app-shell.tsx` is the
only owner (FR-004). This applies equally to `AnnouncementBanners` and
`DirectoryPrivacyPrompt`, which currently pad themselves.

### Focus and motion

A single `:focus-visible` base rule in `app/globals.css` provides the indicator for every
interactive element (FR-005). Every transition uses `duration-fast ease-standard`, and the
existing `prefers-reduced-motion` block suppresses them (FR-037).

---

## Resource card

```text
<article>                       card surface, one <h3>
  ├── format tile               aria-hidden, tone by format, glyph + format text
  ├── source                    .eyebrow, muted
  ├── <h3><Link>                title, links to /app/resources/{id}
  ├── description               muted, clamped
  ├── <ul aria-label="Tags">    omitted entirely when tags is empty
  └── footer                    top rule
       ├── updated date
       ├── format · size        each omitted when null
       ├── audience marker      Badge, lock glyph when restricted
       └── download action      Button, always enabled
```

| Obligation | Requirement |
| --- | --- |
| Grid | One per row below `xl`, two per row at `xl` and above (FR-006, SC-002). |
| List semantics | Cards sit in `<li>` inside a `<ul>`; tags are a nested list (Principle V). |
| Format tile | Decorative. The format is also in the footer text, so the tile is never the sole carrier (FR-034). |
| Download | Never disabled or replaced by the audience marker (FR-010). Its accessible name includes the resource title. |
| Empty tags | The tag list is omitted, not rendered empty (FR-016). |

---

## Filter band

```text
<section aria-labelledby>       visually bounded, heading is sr-only
  └── <form method="get">
       ├── search field         <Label for> + <Input id="resource-q">, leading glyph
       ├── source select        <Label for> + native <select id="resource-source">
       ├── sort select          <Label for> + native <select id="resource-sort">
       ├── topic chips          <ul> of checkbox + label pills
       └── Apply                submit
```

| Obligation | Requirement |
| --- | --- |
| Control ids | `resource-q`, `resource-source`, `resource-sort` are unchanged, so existing accessibility fixtures keep passing. |
| Labels | Every control has a visible `<Label>` bound by `htmlFor`. No placeholder-as-label. |
| Chips | Real `<input type="checkbox">` with a visually hidden box and a pill-styled `<label>`, at least 44px high. `checked` conveys state natively, which satisfies FR-012 without `aria-pressed`. |
| Field chrome | Reuses `controlClassName` from `components/ui/input`, as `tests/unit/control-class-reuse.test.ts` requires. |
| Glyphs | Search and filter glyphs are `aria-hidden` and `pointer-events-none`. |

### Result count and empty state

| Obligation | Requirement |
| --- | --- |
| Count | `aria-live="polite"`, reads "N of M resources" (FR-013). |
| Clear filters | Rendered only when at least one filter is active (FR-014). A link that resets the query, not a scripted control. |
| Empty state | Dashed-border panel with an `<h2>`, guidance copy, and a clear-filters action (FR-015). |

---

## Event row

```text
<article>
  ├── date chip                 aria-hidden, month + day
  └── body
       ├── meta line            sr-only "Date and time: " prefix, then weekday, date, time
       ├── <h3><Link>           title, links to /app/events/{id}
       ├── location line        pin glyph + online-or-in-person and place
       └── status row
            ├── registration    confirmation, waitlist note, or register link
            ├── capacity note   only when capacity is set
            └── audience marker Badge
```

| Obligation | Requirement |
| --- | --- |
| Chip redundancy | The chip is decorative; the same date is in the meta line as real text (FR-024, FR-034). |
| Online events | State that the event is online rather than rendering an empty location (FR-025). |
| Register control | A link to the event detail page styled as an outline button, at least 44px high ([research.md](../research.md) §12). |
| Capacity | Remaining seats only when `capacity` is set, floored at zero (FR-026). |

---

## Announcement card

| Obligation | Requirement |
| --- | --- |
| Surface | Support-toned border and subtle support background, distinct from a plain card. |
| Structure | `.eyebrow` category line, `<h2>` headline, body, CTA forms, posted date. |
| Naming | `<section aria-labelledby>` pointing at the headline id. |
| Container | The existing `<section aria-label="Announcements">` wrapper is retained so `tests/a11y/announcement-pages.test.ts` keeps passing. |
| Dismiss | A `h-tap w-tap` control with an accessible name, positioned without overlapping the headline text (FR-019). |
| CTAs | Remain POST forms to their existing server routes. No URL is exposed client-side. |

---

## Home layout

```text
<header>                        today's date .eyebrow, greeting <h1>, role badge + identity line
<AnnouncementBanners>
<div grid>
  ├── primary column            lg:col-span-8
  │    ├── upcoming events      section, max 3, links to /app/events
  │    └── recent resources     section, max 3, links to /app/resources
  └── <aside> lg:col-span-4
       └── reserved panel       named section, heading, one sentence, no link
```

| Obligation | Requirement |
| --- | --- |
| Columns | Twelve-column grid at `lg`; stacked with the primary column first below it (FR-020). |
| Greeting | First name when known, neutral greeting otherwise, never a partial or blank name (FR-017). |
| Role badge | Omitted when no program role applies (FR-018). |
| Upcoming events section | Carries `aria-label="Upcoming events"`, which the existing accessibility fixture already expects. |
| Empty sections | State the absence in words; never an empty container (FR-023). |
| Reserved panel | Named region, heading, one sentence. No link, no placeholder row, no skeleton (FR-021, [research.md](../research.md) §14). |

---

## Cross-cutting checks

| Check | Where proven |
| --- | --- |
| No literal colour, font, spacing, or radius | source-level unit test over the new components (SC-009) |
| No horizontal scroll at 360px | manual pass in [quickstart.md](../quickstart.md) (SC-003) |
| Zero axe violations on the three pages | `pnpm test:a11y` (SC-004) |
| Every target at least 44×44 | source-level assertion plus manual measurement (SC-005) |
| Light appearance under a dark-set OS | manual pass in [quickstart.md](../quickstart.md) (SC-006) |
| Permission matrix unchanged | `pnpm test` and `pnpm test:rls` (SC-010) |
| Content in the first response | only filter controls and dismiss forms are interactive; no new `use client` (SC-011) |
