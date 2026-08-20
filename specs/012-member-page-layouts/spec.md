# Feature Specification: Member Page Layouts

**Feature Branch**: `012-member-page-layouts`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "The style still isn't right. The layout of the main section does not follow the mockup, including the resources page. There is no option to switch to light mode. The design/layout/style is crucial so please get this right."

## Context

Slice `008-design-tokens` ported the theme token values. Slice `011-app-shell` ported the
frame: sidebar, mobile top bar, bottom tab bar, and the main content well. Neither slice
touched what sits inside that well — `011` scoped page bodies out explicitly. The result is
a correct frame around page bodies that still carry pre-design markup, so member pages do
not resemble the approved design even though the shell does.

Two further gaps surfaced from the same review:

- `008` mapped the design's opt-in dark appearance onto the operating system's dark
  preference and recorded "no user-facing theme control" as an assumption. Members on a
  dark-set device therefore get a dark portal with no way to leave it.
- `008` ported token values but not the design's shared base layer, so the small uppercase
  category line used by every page header and section header in the design does not exist.

This slice closes those gaps. The approved design reference is the `mockup/` directory.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent page and section framing (Priority: P1)

A member moving between pages meets the same framing every time: a short uppercase category
line, then the page title, then a one-line description of what the page is for. Content
below is grouped into labelled sections that share one visual rhythm, and a section that
shows only a preview of a longer list offers a link to the full list.

**Why this priority**: Every other story sits inside this framing. Without it each page
reads as a separate product, which is the core of the reported problem. It is also the
smallest change that visibly moves every member page toward the design at once.

**Independent Test**: Open each member page and confirm the header triple, the section
framing, and the presence of a full-list link on any previewed section. Delivers immediate
visual coherence even before individual cards are restyled.

**Acceptance Scenarios**:

1. **Given** a signed-in member on any member page, **When** the page loads, **Then** the
   first content is a category line, followed by the page title, followed by a short
   description where the page has one.
2. **Given** a page containing more than one content group, **When** the member scans it,
   **Then** each group carries its own category line and title with the same spacing and
   dividing treatment as every other group.
3. **Given** a section that shows only the first few items of a longer list, **When** the
   member reaches its header, **Then** a link to the full list is available in that header.
4. **Given** a member using a keyboard, **When** they move focus through a page, **Then**
   every focused element shows a visible focus indicator meeting 3:1 against its surface.

---

### User Story 2 - Resource library reads as a browsable catalogue (Priority: P1)

A member opening the library sees a filter band holding a labelled search field, a source
selector, and a row of toggleable topic filters, followed by a count of how many resources
match. Results appear as cards: a format tile, the issuing source, the title, a short
description, topic tags, and a footer carrying the last-updated date, the file format and
size, who the item is available to, and a download action.

**Why this priority**: The library is the most-used page and the one the reviewer called
out by name. It also exercises every card element the rest of the design reuses.

**Independent Test**: Browse, search, and filter the library and confirm card anatomy,
grid behaviour, the live count, and the empty state. Delivers a complete, usable page on
its own.

**Acceptance Scenarios**:

1. **Given** a member on the library, **When** the viewport is wide, **Then** resources
   appear two to a row; **When** it is narrow, **Then** they appear one to a row.
2. **Given** a resource card, **When** the member reads it, **Then** it shows source,
   title, description, topic tags, last-updated date, file format, file size, an audience
   marker, and a download action.
3. **Given** a member types a search term, **When** results narrow, **Then** the count of
   matching against total resources updates and is announced politely to assistive tech.
4. **Given** a member activates a topic filter, **When** it becomes active, **Then** its
   pressed state is communicated to assistive technology and activating it again clears it.
5. **Given** any filter is active, **When** the member looks near the count, **Then** a
   clear-filters action is available; **Given** no filter is active, **Then** that action
   is absent.
6. **Given** filters that match nothing, **When** results render, **Then** an explicit
   empty state appears with a heading, guidance, and a way to clear the filters.
7. **Given** a resource with no topic tags, **When** its card renders, **Then** the tag
   area is omitted rather than rendered empty.

---

### User Story 3 - Home orients the member (Priority: P2)

A member landing on home is greeted by first name under today's date, with their program
role shown as a badge beside a short identity line. Any active announcement appears as a
prominent bordered card carrying its category line, headline, body, call to action, and
posted date. Below that, the page splits: upcoming events and recent resources fill the
primary column, and a narrower reserved column states that public writing is not yet
available here.

**Why this priority**: Home is the first impression and the screenshot the reviewer
compared. It depends on the framing from Story 1 and reuses the cards from Story 2, so it
follows them.

**Independent Test**: Sign in and confirm the greeting, role badge, announcement card,
two-column split, previewed event and resource lists, and the reserved column.

**Acceptance Scenarios**:

1. **Given** a signed-in member whose display name is known, **When** home loads, **Then**
   today's date appears as the category line above a greeting using their first name.
2. **Given** a member whose display name is unavailable, **When** home loads, **Then** a
   neutral greeting appears with no empty placeholder or partial name.
3. **Given** a member with a program role, **When** home loads, **Then** that role appears
   as a badge next to a short identity line.
4. **Given** one or more announcements are active for the member, **When** home loads,
   **Then** each appears as a bordered emphasis card with category line, headline, body,
   its call to action where one is configured, and its posted date.
5. **Given** a dismissible announcement, **When** the member dismisses it, **Then** it is
   removed and the dismiss control was at least 44 by 44 pixels.
6. **Given** a wide viewport, **When** home loads, **Then** the primary column holds
   upcoming events followed by recent resources, and a narrower second column sits beside
   it; **Given** a narrow viewport, **Then** the columns stack with the primary first.
7. **Given** the reserved column, **When** a member or screen reader reaches it, **Then**
   it is a labelled region stating that public writing is not yet available, containing no
   non-functional link and no empty container.
8. **Given** more than three upcoming events or recent resources exist, **When** home
   loads, **Then** at most three of each appear, each section linking to its full list.
9. **Given** no upcoming events, or no resources, or no active announcements, **When** home
   loads, **Then** the affected section states the absence in words instead of rendering an
   empty container.

---

### User Story 4 - Events read as a scannable calendar (Priority: P2)

A member scanning events sees each one as a row led by a date chip showing month and day,
followed by the full weekday, date and time, the title, whether it is online or in person
and where, the member's registration state or a register action, a capacity note, and who
the event is open to.

**Why this priority**: Events reuse the row anatomy that home previews, so aligning the
full list keeps the two consistent. Lower than the library because it is less trafficked.

**Independent Test**: Open the events list and confirm chip, meta line, registration
state, capacity note, and audience marker on each row.

**Acceptance Scenarios**:

1. **Given** an event, **When** its row renders, **Then** a date chip shows the month and
   day, and a separate line gives the full weekday, date, and time.
2. **Given** an event the member has registered for, **When** the row renders, **Then** a
   registration confirmation appears in place of a register action.
3. **Given** an event the member has not registered for, **When** the row renders, **Then**
   a register action of at least 44 by 44 pixels appears.
4. **Given** an event with a known capacity, **When** the row renders, **Then** a remaining
   capacity note appears; **Given** no capacity is set, **Then** no note appears.
5. **Given** an event that is online rather than in person, **When** the row renders,
   **Then** the row says so and does not present an empty location.

---

### User Story 5 - One light appearance (Priority: P3)

Every member sees the portal in the light warm-stone appearance the design specifies, on
every device, whatever their operating system's dark preference is set to.

**Why this priority**: It removes an active complaint and unblocks visual review against
the design, but it changes no layout. It is also the smallest of the five changes.

**Independent Test**: Set the operating system to dark, load any member page, and confirm
the light appearance renders.

**Acceptance Scenarios**:

1. **Given** a device set to a dark colour preference, **When** a member loads any member
   page, **Then** the portal renders in the light appearance.
2. **Given** any member page, **When** a reviewer inspects it, **Then** no dark appearance
   is reachable and no theme control is presented.

---

### Edge Cases

- A resource, event, or announcement title long enough to wrap several lines must wrap
  without overflowing its card or changing the card's structure relative to its neighbours.
- A resource whose file format cannot be determined from stored data must omit the format
  rather than display an unknown-format placeholder.
- A resource whose stored size is zero or absent must omit the size.
- A member with no program role, or a pending member, must still receive a coherent header
  rather than an empty badge.
- At 360 pixels wide, no member page may scroll horizontally.
- With a reduced-motion preference set, no hover or state transition may animate.
- A member with many active announcements must not be pushed so far down that no other
  content is reachable above the fold on a narrow screen.
- Sections that preview a longer list must behave correctly when the list holds exactly
  three items, fewer than three, and none.

## Requirements *(mandatory)*

### Functional Requirements

#### Shared page framing

- **FR-001**: Member pages MUST present a page header consisting of a category line, a page
  title, and, where the page has one, a short description, in that order.
- **FR-002**: Content groups within a page MUST present a section header consisting of a
  category line and a section title, optionally accompanied by a link to the full list of
  that group's items.
- **FR-003**: The category line treatment MUST be defined once and available to every page
  and section, and MUST be distinguishable from body text by capitalisation, letter
  spacing, and type family.
- **FR-004**: Page content MUST NOT introduce its own outer page padding; the spacing
  between the application frame and page content MUST be controlled in one place so that
  every member page indents identically.
- **FR-005**: A visible focus indicator meeting 3:1 against its surrounding surface MUST be
  applied to interactive elements from one shared definition rather than declared per
  component.

#### Resource library

- **FR-006**: The library MUST lay resources out one to a row on narrow viewports and two to
  a row on wide viewports.
- **FR-007**: Each resource card MUST show the issuing source, the title, a short
  description, its topic tags, the last-updated date, the file format, the file size, an
  audience marker, and a download action.
- **FR-008**: The file format label MUST be derived from the resource's stored file type.
  Where no known format matches, the card MUST omit the format rather than show a
  placeholder value.
- **FR-009**: The file size MUST be presented in human-readable units derived from the
  stored byte count, and omitted when no usable size is stored.
- **FR-010**: Because members are only ever served resources their roles already permit,
  the audience marker MUST describe who the resource is available to and MUST NOT gate,
  disable, or replace the download action.
- **FR-011**: Search, source, and topic controls MUST sit together in one visually bounded
  filter band above the results, each with a visible label.
- **FR-012**: Each topic filter MUST be independently toggleable, MUST communicate its
  pressed state to assistive technology, and MUST be reversible by activating it again.
- **FR-013**: The results area MUST state how many resources match out of the total
  available to that member, and MUST announce changes to that count politely.
- **FR-014**: A clear-filters action MUST be present whenever at least one filter is active
  and absent when none is.
- **FR-015**: When no resource matches the active filters, the page MUST show an explicit
  empty state carrying a heading, guidance on what to change, and a clear-filters action.
- **FR-016**: A resource with no topic tags MUST omit the tag area rather than render an
  empty one.

#### Home

- **FR-017**: Home MUST greet the member by first name beneath today's date, and MUST fall
  back to a neutral greeting containing no placeholder when the display name is unavailable.
- **FR-018**: Home MUST show the member's program role as a badge beside a short identity
  line, omitting the badge when no program role applies.
- **FR-019**: Active announcements MUST render as a bordered emphasis card carrying a
  category line, headline, body, the configured call to action where present, and the posted
  date, with a dismiss control of at least 44 by 44 pixels on dismissible announcements.
- **FR-020**: On wide viewports home MUST place upcoming events followed by recent
  resources in a primary column with a narrower secondary column beside it, and MUST stack
  them with the primary column first on narrow viewports.
- **FR-021**: The secondary column MUST be a labelled region stating that public writing is
  not yet available in the portal, and MUST NOT contain a non-functional link, a
  placeholder item, or an empty container.
- **FR-022**: Home MUST preview at most three upcoming events and at most three recent
  resources, each section linking to its full list.
- **FR-023**: Where a previewed section has no items, home MUST state that absence in words
  rather than render an empty container.

#### Events

- **FR-024**: Each event MUST present a date chip carrying month and day, plus a separate
  line giving the full weekday, date, and time.
- **FR-025**: Each event MUST state whether it is online or in person together with its
  location, and MUST not present an empty location for an online event.
- **FR-026**: Each event MUST show either a registration confirmation or a register action
  of at least 44 by 44 pixels, according to the member's current registration state, and
  MUST show a remaining capacity note only where a capacity is set.
- **FR-027**: Each event MUST carry an audience marker describing who it is open to.

#### Appearance

- **FR-028**: The portal MUST render in a single light appearance for every member, and the
  operating system's dark colour preference MUST NOT change it.
- **FR-029**: No user-facing theme control may be presented in this slice.

#### Cross-cutting

- **FR-030**: All colour, type, spacing, and radius in new or changed presentation MUST come
  from the existing token set; literal values are forbidden.
- **FR-031**: Audience markers, role labels, and registration state MUST be determined from
  data the server already established, and MUST NOT be computed in the browser from a role
  value supplied to it.
- **FR-032**: This slice MUST NOT change which items any role can see. The audience marker
  is a label on already-permitted content, not a new visibility rule.
- **FR-033**: No member page may scroll horizontally at 360 pixels wide.
- **FR-034**: Icons MUST be decorative, hidden from assistive technology, and MUST NEVER be
  the only carrier of a meaning that is not also in text.
- **FR-035**: Every interactive target MUST be at least 44 by 44 pixels.
- **FR-036**: Page content MUST be present in the first response, with client-side behaviour
  confined to the individual controls that need it, so the authenticated portal stays within
  its transfer budget.
- **FR-037**: Transitions MUST be suppressed when a reduced-motion preference is set.

### Key Entities

This slice adds no persisted data and changes no schema. It introduces presentation-level
concepts only:

- **Page header**: the category line, title, and optional description that opens a page.
- **Section header**: the category line, title, and optional full-list link that opens a
  content group.
- **Resource card view**: the display shape of one resource, including a format label and
  human-readable size derived from stored file type and byte count.
- **Event row view**: the display shape of one event, including a date chip, an
  online-or-in-person statement, and the viewer's registration state.
- **Announcement card view**: the display shape of one active announcement, including its
  call to action and posted date.
- **Audience marker**: a label describing who a resource or event is available to, derived
  from that item's stored audience.
- **Reserved panel**: a labelled region standing in for a section whose underlying feature
  is not yet built.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer comparing home, the library, and events against the approved
  design finds the same page header pattern, section rhythm, and card anatomy on all three.
- **SC-002**: On a viewport of 1280 pixels or wider the library shows two resources per row;
  below that it shows one.
- **SC-003**: At 360 pixels wide, no member page scrolls horizontally.
- **SC-004**: An automated accessibility scan reports zero violations on home, the library,
  and events.
- **SC-005**: Every interactive target on the three pages measures at least 44 by 44 pixels.
- **SC-006**: With the operating system set to a dark colour preference, every member page
  renders in the light appearance.
- **SC-007**: Applying a search term, a source, and a topic filter narrows the results and
  the stated count matches the number of cards shown in every case.
- **SC-008**: Keyboard traversal of each page reaches every control in visual order with a
  visible focus indicator at each stop.
- **SC-009**: New or changed presentation contains zero literal colour, font, spacing, or
  radius values.
- **SC-010**: The permission matrix produces identical results before and after this slice,
  through the application and directly against the database.
- **SC-011**: Every page's content is present in the first response, with only the filter
  controls and dismiss actions requiring client-side behaviour.
- **SC-012**: The authenticated portal stays within its 180 KB gzip transfer budget.

## Assumptions

- Dropping the dark appearance reverses two assumptions recorded for `008-design-tokens`:
  that the operating system's dark preference would keep working, and that no user-facing
  theme control would exist. The reviewer chose a single light appearance over both an
  automatic switch and an in-app toggle. This reversal is recorded in the assumptions log.
- The design's right-hand public-writing column is reserved rather than built. Its source
  feature is PRD §5.8, which is not implemented, so the column states that the content is
  not yet available. This was the reviewer's explicit choice over omitting the column or
  building the feature now.
- The design's forum activity block is not included, because forum content belongs to a
  later phase and has no data behind it yet.
- The design's sample identity details, such as region and membership start year, appear
  only where equivalent real profile data already exists; otherwise they are omitted rather
  than invented.
- The design's illustrative role names map onto this product's existing program roles. This
  slice introduces no new role vocabulary and no role-specific colour scheme.
- The design's locked and request-access resource state does not apply, because members are
  only ever served content their roles already permit. The audience marker replaces it as a
  label rather than a gate.
- Icons extend the icon set already established in `011-app-shell`. No new icon library is
  introduced.
- No schema change is required: the file format derives from the stored file type and the
  displayed size derives from the stored byte count, both of which the resource record
  already holds.
- The design's Forum and Profile destinations remain out of scope; this slice restyles only
  pages that already exist.

## Dependencies

- `011-app-shell` supplies the frame, the navigation, and the icon set this slice extends.
- `008-design-tokens` supplies the token values. This slice completes the shared base layer
  that `008` did not port, and reverses its dark-appearance decision.
- `004-resource-library`, `005-announcements`, and `006-event-calendar` supply the data and
  the role gating behind these pages. This slice changes neither.
- PRD §B.4 governs the navigation this slice does not alter. PRD §5.8 is the unbuilt source
  of the reserved column.
