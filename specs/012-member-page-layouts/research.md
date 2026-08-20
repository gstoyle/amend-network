# Phase 0 Research: Member Page Layouts

**Slice**: `012-member-page-layouts` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

Sixteen decisions. No unresolved unknowns remain.

---

## 1. The dark appearance is removed, not left inert

**Decision**: Delete the `@media (prefers-color-scheme: dark)` block from `app/tokens.css`
entirely, and declare `color-scheme: light` on the root so browser-rendered chrome — native
select popups, scrollbars, date pickers, form control defaults — also stays light on a
dark-set device.

**Rationale**: Spec FR-028, FR-029. Leaving the overrides in the file behind a selector
nothing sets would be dead code that reads as a live feature. The `color-scheme` declaration
matters more than it looks: without it, a dark-set operating system still darkens native
controls, so the page would render light with dark select menus and scrollbars, which is
exactly the kind of half-applied appearance the reviewer reported.

**Verified before committing to it**: both token tests tolerate the block's absence.
`tests/unit/design-tokens.test.ts` searches for a media block, then a `:root.dark` block, and
falls back to an empty override map; `tests/unit/a11y-lock.test.ts` does the same with a regex
match guarded by `if (darkBlock)`. In both, the dark contrast pass then re-checks the light
values, which still passes. Neither test needs editing, though both then assert light twice,
which is worth a comment so a future reader is not misled.

**Alternatives considered**:

- Keep the media query and add an override class — the reviewer explicitly rejected both
  offered toggle designs.
- Keep the dark values behind `:root.dark` with nothing setting the class — dead code that
  invites a future contributor to assume a toggle exists.

---

## 2. The category line is one utility, composed from existing theme keys

**Decision**: Define `.eyebrow` once in `app/globals.css` under `@layer utilities` as
`@apply font-mono text-eyebrow uppercase`, matching the design's own class name.

**Rationale**: Spec FR-003. The `008` theme already exposes a `fontSize.eyebrow` key that
carries size, line-height, *and* letter-spacing, and a `fontFamily.mono` key. So the whole
treatment composes from tokens with no literal values and no new CSS custom property. Naming
it `.eyebrow` keeps the vocabulary identical to the design reference, which makes the two
easy to compare during review.

**Alternatives considered**:

- Repeat `font-mono text-eyebrow uppercase` at every use site — token-pure but violates
  FR-003's "defined once", and drift across pages is exactly the current problem.
- A presentational `<Eyebrow>` component — heavier than needed, and the design applies the
  treatment to spans inside chips and tiles as well as to paragraphs.

---

## 3. The shared base layer `008` never ported

**Decision**: Port the remaining `@layer base` rules from the design's stylesheet into
`app/globals.css`: a global `:focus-visible` outline built from `--focus-width`,
`--focus-offset`, and `--ring`; a `::selection` treatment from the primary-subtle pair; and
`text-wrap: balance` on headings.

**Rationale**: Spec FR-005. `008` copied token *values* but not the base rules that consume
them, so focus styling is currently declared per component and inconsistently. One base rule
guarantees FR-005 everywhere, including on elements a later slice adds without thinking about
it, and satisfies Principle V's focus-indicator obligation structurally rather than by
review.

**Alternatives considered**: continue declaring `focus-visible:ring-2` per component — that
is the status quo, and any component that forgets it silently fails Principle V.

---

## 4. Page padding moves to one owner

**Decision**: Remove the `p-6` wrapper from every member page body and from
`AnnouncementBanners` and `DirectoryPrivacyPrompt`. The `<main>` in `components/app-shell.tsx`
already carries `px-gutter pb-24 pt-6 lg:px-gutter-lg lg:pb-16 lg:pt-10`, matching the design.

**Rationale**: Spec FR-004. Today every page double-pads: the shell's main pads, then the page
adds another `p-6`, and the banner and privacy components each add a third. That is a direct
cause of the reported "main section does not follow the mockup" — content sits further in and
further down than the design, and the banners are inset differently from the page below them.

**Alternatives considered**: strip the shell's padding and let pages own it — worse, because
it makes every future page responsible for matching, which is how the drift started.

---

## 5. Icons extend the existing inline set

**Decision**: Extend `components/ui/icon.tsx` with the additional glyphs these pages need:
`search`, `filter`, `close`, `announce`, `arrow-right`, `arrow-up-right`, `pin`, `check`,
`download`, `lock`, `users`, `file`, `video`, `template`, `toolkit`, `slides`.

**Rationale**: Spec FR-034 and continuity with `011` research §1, which chose inlined SVG over
a dependency. The existing file already establishes the API (`name` plus `className`,
`aria-hidden`, `stroke="currentColor"`), so this is extension rather than a new file, which
Principle "prefer extending an existing helper" requires.

**Alternatives considered**: add the icon library the mockup imports — rejected in `011` for
the same reason it is rejected here. Sixteen more static paths do not justify a runtime
dependency inside the 180 KB budget.

---

## 6. A badge primitive is genuinely new

**Decision**: Add `components/ui/badge.tsx` exporting a `Badge` with `neutral`, `primary`, and
`support` tones.

**Rationale**: Three separate needs — the program-role badge on home, the audience marker on
resources and events, and the topic tag chips on resource cards — are the same small bordered
label at different tones. Nothing existing can be extended: `button.tsx` carries interactive
semantics and a 44px minimum that a static label must not have, and `card.tsx` exports only a
class-name constant.

**Alternatives considered**: repeat the class string at each of the three sites — guarantees
drift, and the tag chips already appear on two different cards.

---

## 7. Filtering stays server-side, with an explicit apply

**Decision**: Keep the existing `GET` form on the library. Style the topic filters as pill
chips that are genuinely `<input type="checkbox">` with a visually hidden box, keep the source
selector a native `<select>`, and keep the existing Apply submit. Do not add live filtering.

**Rationale**: Spec FR-036 and Principle V's server-component default. The design filters as
you type because it is a client-side playground over sample data. Reproducing that would make
the whole filter band a client component holding the result list, which would move the
catalogue out of the first response. A checkbox also satisfies FR-012 for free: `checked` is
communicated natively to assistive technology and toggling is inherently reversible, whereas
`aria-pressed` on a link — the alternative if chips were navigation links — is invalid.

**Deviation from the design, recorded deliberately**: the design has no Apply control. Ours
does, and the count therefore updates on submit rather than per keystroke. FR-013's polite
announcement still holds, since the count region re-renders on navigation.

**Alternatives considered**:

- Chips as links that toggle a query parameter — no valid way to express pressed state, and
  each click is a full navigation.
- Auto-submitting the form on change — needs client scripting for no gain over Apply, and
  would fire a request per keystroke.

---

## 8. The native select is retained

**Decision**: Do not port the design's custom select. Keep the native `<select>` styled with
the existing `controlClassName`, plus a chevron.

**Rationale**: The design's select is a client-side composite of trigger, popover, and items.
Native gives correct mobile behaviour, correct assistive-technology semantics, keyboard
support, and zero JavaScript. `tests/unit/control-class-reuse.test.ts` already requires
`resource-filters.tsx` to consume `controlClassName` rather than duplicate field chrome, so
this also keeps that constraint satisfied.

**Alternatives considered**: port the composite select — a client component and a real
accessibility risk, to gain a chevron we can draw.

---

## 9. Resource format and size are derived in `lib/`, not in the card

**Decision**: Extend `MemberResource` in `lib/resources/list.ts` with `fileSizeBytes`, and add
derivations there that produce a `formatLabel` (`PDF`, `Video`, `Slides`, `Template`,
`Toolkit`) from `fileMimeType` and a human-readable `sizeLabel` from the byte count. Both are
nullable, and the card omits whichever is null.

**Rationale**: Spec FR-008, FR-009, FR-016, FR-031. `fileSizeBytes` already exists on the
`Resource` model and is simply not selected today, so no schema change is needed. Deriving in
`lib/` rather than in the component honours the code-layout constraint that `components/` is
presentational, and it makes both derivations unit-testable without rendering.

**Alternatives considered**: derive in the card from `fileMimeType` — puts logic in a
presentational component, and gives no place to unit-test the byte formatting.

---

## 10. The audience marker is a server-derived label, never a client-side role check

**Decision**: Add an `audienceLabel(visibility: string[])` helper to the existing
`lib/db/visibility.ts`, returning `{ label, restricted }`. Surface that on the resource and
event view types. The card receives a finished label and a boolean.

**Rationale**: Spec FR-010, FR-031, FR-032, and Principle I. This is the highest-risk part of
a design slice: an audience badge looks like a permission feature. It is not. The member is
only ever served rows their roles already intersect, so the badge describes the audience of
content they may already see, and it must never gate the download action. Putting the
derivation in `lib/db/visibility.ts` — which already owns `visibilityTokens` and therefore the
`all_authenticated | pathways | lead` vocabulary — keeps the one place that understands
visibility tokens authoritative, and keeps role vocabulary out of `components/`.

**Alternatives considered**:

- Pass `visibility: string[]` to the card and map it there — puts the role vocabulary into a
  presentational component, which the constitution's code-layout section forbids.
- Reproduce the design's locked and request-access state — would imply members receive rows
  they cannot open, which is false here and would misrepresent the authorization model.

---

## 11. Event rows need registration state and seat counts the list does not return

**Decision**: Extend `listVisibleEvents` and `listUpcomingEvents` in `lib/events/list.ts` to
include the viewer's own RSVP status and a confirmed-attendee count, both resolved inside the
existing `withRls` transaction.

**Rationale**: Spec FR-026. `MemberEvent` today carries no RSVP state and no attendee count —
`getOwnEventRsvp` is per-event and the seat arithmetic lives inside `setEventRsvp` — so the
design's "You are registered" and remaining-capacity note cannot be rendered from the list.
Neither addition widens visibility: the RSVP row read is the viewer's own by primary key, and
the count aggregates RSVPs for events whose visibility the viewer already intersects. Because
this touches content-table queries, it needs fail-first tests and a `pnpm test:rls` run under
Principle IV.

**Alternatives considered**:

- Leave registration state off the row — the reviewer named the events mockup as a target, and
  the registration line is the row's most prominent element.
- Fetch RSVP state per row from the component — N+1 queries and data fetching inside
  `components/`, both forbidden.

---

## 12. The register action links to the event, it does not post from the list

**Decision**: The row's register control is a link to the event detail page, styled as the
design's outline button. RSVP submission stays where it is, on the detail page.

**Rationale**: RSVP is a state change with CSRF protection and waitlist arithmetic. Exposing a
second submission surface on the list would duplicate that logic and double the number of
places a capacity race can be introduced, for a purely visual gain. The design's list-level
Register button is sample-data behaviour with no persistence behind it.

**Deviation from the design, recorded deliberately**: visually identical, one navigation step
before the actual RSVP.

---

## 13. The announcement card needs a posted date

**Decision**: Extend `MemberBanner` in `lib/announcements/list.ts` with `postedAt`, sourced
from `activatesAt`, which the query already orders by.

**Rationale**: Spec FR-019. The design's card ends with a posted date and the current banner
type carries none. `activatesAt` is the date the announcement became visible to the member,
which is the meaning the design's label conveys. The existing calls-to-action stay as POST
forms to their server routes; this slice restyles them and does not expose CTA URLs to the
client, preserving the `005` design.

**Alternatives considered**: use `createdAt` — when an announcement is authored ahead of time,
that date is meaningless to a member reading it weeks later.

---

## 14. The reserved column is a labelled region with no affordance

**Decision**: Render the second home column as a `<section>` with an accessible name, a
heading, and one sentence stating that public writing is not yet available. No link, no
placeholder rows, no skeleton.

**Rationale**: Spec FR-021 and the recorded assumption. A skeleton or a dead link both read as
breakage, and a dead link fails Principle V. A named region with a sentence is honest to both a
sighted reader and a screen-reader user, and it holds the design's column proportions so that
building PRD §5.8 later is an insert rather than a re-layout.

**Alternatives considered**: omit the column — changes the primary column's width, so home
would need re-laying-out when the blog ships. The reviewer chose reservation.

---

## 15. Home previews come from existing helpers with a limit applied at the page

**Decision**: Home calls `listUpcomingEvents` and `listResources` (newest first) and takes the
first three of each in the page component.

**Rationale**: Spec FR-022. Both helpers already apply visibility and ordering; adding a limit
parameter to them would be a wider change for one caller. Slicing at the page is the smallest
correct move, and the helpers stay single-purpose.

**Alternatives considered**: add a `limit` option to both helpers — more surface area, and the
row counts are a presentation decision that belongs with the page.

---

## 16. Existing assertions that must move with the markup

**Decision**: Update four assertions written against pre-design markup, and record each as a
deviation in `tasks.md` rather than weakening the test.

**Rationale**: Principle IV forbids deleting a failing assertion to make a change pass, so each
edit needs a stated reason:

- `tests/unit/shared-chrome.test.ts` requires `resource-card.tsx` to contain an `<img>`. The
  mockup shows a format glyph, but `004-resource-library` requires the authenticated thumbnail
  grant on the card. The tile stays as the fallback under the `<img>`; the assertion is kept.
  See also [011 research §14](../011-app-shell/research.md).
- `tests/a11y/resource-pages.test.ts` fixtures model a card with a thumbnail image. The fixture
  moves to the new anatomy; the control ids `resource-q`, `resource-source`, and `resource-sort`
  stay exactly as they are, because the form keeps working the same way.
- `tests/a11y/event-pages.test.ts` expects home's upcoming-events section to carry
  `aria-label="Upcoming events"`. The current page has no such label, so this assertion starts
  passing for real rather than needing a change.
- `tests/unit/control-class-reuse.test.ts` needs no change and acts as a guard that the restyled
  filter band still consumes `controlClassName`.

**Alternatives considered**: drop the `<img>` to match the mockup glyph — rejected against 004.
The tile is the fallback under the thumbnail, not a replacement.
