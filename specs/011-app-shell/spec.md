# Feature Specification: Authenticated App Shell

**Feature Branch**: `011-app-shell`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Port the mockup's shell and primary navigation into the real app. The member area currently renders a bare row of underlined text links instead of the mockup's portal layout (left sidebar on desktop, bottom tab bar on mobile, compact top bar on mobile). Slice 008 extracted the mockup's tokens but explicitly excluded navigation patterns, new components, and the mobile bottom bar, so PRD Appendix B.4 primary navigation was never built. Build it against PRD B.4 and B.5, reusing the existing token set, without changing routes, authorization, copy, or page content."

**Cites**: PRD v1.1 Appendix §B.4 (primary navigation for authenticated members: bottom bar on mobile, left sidebar on desktop) and §B.5 (admin overlay reachable from the member experience, never a forced choice between member view and admin view); PRD §7 (44×44 targets, 360px mobile-first, contrast, keyboard navigation, semantic landmarks); Constitution v1.0.0 Principle I (nav must not expose destinations a role cannot open; role from the signed session), Principle V (token-driven, accessible interface; server components by default; `use client` at leaf nodes only). Consumes the token set delivered by `008-design-tokens`; picks up the navigation IA that slice put **out of scope**.

## Scope

Slices `002`–`010` shipped every authenticated destination the product currently has, and `008-design-tokens` gave them Amend's palette, type scale, spacing, and radii. What none of them delivered is the **frame those pages sit in**. `008` said so explicitly in its Out of Scope list: "New screens, new components, new navigation patterns, or a mobile bottom bar (PRD §7 bottom-bar IA is not this slice)."

The result is a correctly themed product with placeholder chrome: a single wrapped row of underlined links above the content, identical for members and staff, with no sense of place, no persistent identity, no mobile navigation pattern, and no way to tell which section you are in.

This slice builds the shell PRD Appendix B describes, using the mockup in `/mockup` as the visual and structural source, exactly as `008` used it as the token source.

**In scope**

- A persistent authenticated shell around member destinations: desktop side navigation, mobile bottom navigation, and a mobile top bar
- Primary navigation to the destinations that exist today, with the current section clearly indicated
- A profile/account area holding the destinations currently stranded in the link row (privacy, sessions, sign out) plus the administrative entry point for those who have one
- Administrative chrome that shares the same shell language as the member experience rather than being a second skin
- Role-aware navigation: a destination the signed-in person may not open is absent from navigation, not shown-and-refused
- Keeping WCAG 2.1 AA on the new chrome: ≥ 4.5:1 body contrast, ≥ 3:1 interactive boundaries and focus, ≥ 44×44 targets, visible focus, landmarks, `prefers-reduced-motion` honored
- Mobile-first behavior at 360px with no horizontal scroll and no content hidden behind fixed chrome
- Proof that every existing permission, route, and accessibility suite from `002`–`010` still passes unchanged

**Out of scope**

- Any change to routes, route names, authorization outcomes, form behavior, validation, copy, or data
- Redesign of page bodies. Pages gain a frame; their content is untouched
- New destinations. Forum (PRD §B.4) is a later phase and has no route yet
- The WordPress blog sidebar feed (PRD §5.8)
- New token values, a second theme, or an in-app light/dark switcher. The `008` token set is the input, unchanged
- Avatar image upload or profile photography. Identity display uses what the product already holds
- Unauthenticated pages (sign-in, registration, invitation, password reset). Those keep their current centered layout
- Search as a global feature. Any search entry point in chrome links to an existing search screen
- New audit actions, new analytics events, schema changes, or background work

## User Scenarios & Testing *(mandatory)*

Primary actors: **signed-in members** (Pathways or LEAD) on phones and desktops, **staff** who hold both a program role and an administrative role, and **pending users** who are signed in but not yet approved.

### User Story 1 - A member always knows where they are and where they can go (Priority: P1)

A signed-in member opens the member area on a desktop browser. A persistent side navigation lists the destinations available to them, with the section they are currently viewing visibly marked. They move between home, resources, events, and the directory without hunting through a wrapped row of text links, and the frame stays put as content changes.

**Why this priority**: This is the whole reason the slice exists. Without persistent, oriented navigation the product reads as an unfinished prototype regardless of how correct the colors are.

**Independent Test**: Sign in as an approved member on a desktop viewport. Confirm the side navigation lists every member destination that exists, that the current section is marked, and that each entry opens the same route it opens today.

**Acceptance Scenarios**:

1. **Given** an approved member on any member page at desktop width, **When** they view the screen, **Then** persistent side navigation is present listing the member destinations available to their role.
2. **Given** a member viewing a section, **When** they look at navigation, **Then** the entry for that section is marked as current in a way that does not depend on color alone.
3. **Given** a member on a detail page beneath a section (for example an individual resource or event), **When** they look at navigation, **Then** the parent section is marked as current.
4. **Given** a member selects any navigation entry, **When** the destination loads, **Then** it is the same route, with the same content and permissions, as before this slice.
5. **Given** a member on any authenticated page, **When** they look for account actions, **Then** privacy, active sessions, and sign out are reachable from a single account area rather than scattered in the primary link row.

---

### User Story 2 - The shell works on a phone (Priority: P1)

A member opens the platform on a 360px-wide phone, often a shared or borrowed device. A compact top bar identifies the platform, and a bottom navigation bar puts the primary destinations under their thumb. Nothing requires sideways scrolling, no content is trapped underneath the fixed bars, and every target is large enough to hit reliably.

**Why this priority**: PRD §7 makes mobile-first at 360px a requirement, and the member base is phone-first. A desktop-only shell would not be shippable.

**Independent Test**: Load member home, a list page, and a form at 360px width. Confirm bottom navigation is present and reachable, that the page scrolls to its true end without content sitting under the bar, that no horizontal scroll occurs, and that every chrome target measures at least 44×44.

**Acceptance Scenarios**:

1. **Given** a member at 360px width, **When** they view any member page, **Then** bottom navigation is present and side navigation is not.
2. **Given** a member at desktop width, **When** they view any member page, **Then** side navigation is present and bottom navigation is not.
3. **Given** a member at 360px scrolling to the end of a long page, **When** they reach the bottom, **Then** the final content is fully readable and not covered by fixed navigation.
4. **Given** any navigation or account control in the shell at any width, **When** its hit area is measured, **Then** it is at least 44×44 CSS pixels.
5. **Given** a member at 360px on any authenticated page, **When** they attempt to scroll horizontally, **Then** no horizontal scrolling is available.
6. **Given** a device that reserves screen edges for system gestures, **When** bottom navigation renders, **Then** its targets remain fully tappable above that reserved area.

---

### User Story 3 - Staff reach admin tools without leaving the product (Priority: P2)

A staff member holds a program role and an administrative role. From their account area they reach administrative destinations, and administrative screens carry the same shell language as the member area. They are never asked to pick a "member mode" or an "admin mode" — both are simply available, each respecting its own role.

**Why this priority**: PRD §B.5 states this directly. Today the admin area has its own separate placeholder link row, which is the second-skin outcome the PRD rules out.

**Independent Test**: Sign in as an Admin with MFA satisfied. Confirm an administrative entry point appears in the account area, that administrative screens use the same shell as member screens, and that member destinations remain available to that same person without switching modes.

**Acceptance Scenarios**:

1. **Given** a signed-in user with an administrative role, **When** they open their account area from a member page, **Then** an administrative entry point is present.
2. **Given** a staff member on an administrative screen, **When** they view layout chrome, **Then** it uses the same navigation pattern and visual language as the member shell, not a separate design.
3. **Given** a staff member on an administrative screen, **When** they look at navigation, **Then** member destinations remain reachable without signing out or toggling a mode.
4. **Given** a staff member whose administrative session has not satisfied MFA, **When** they select an administrative destination, **Then** the existing MFA challenge behaves exactly as it does today.

---

### User Story 4 - Navigation shows only what the person may open (Priority: P2)

Navigation is built from the signed-in person's own roles. A member with no administrative role sees no administrative entry point anywhere in the chrome. A pending user, who may only see the holding page, is not offered destinations they will be redirected away from.

**Why this priority**: Constitution Principle I forbids trusting a client-supplied role and forbids treating navigation as a place where authorization is decided. Chrome that advertises a destination and then refuses it leaks the shape of the staff surface to members.

**Independent Test**: Sign in as a Pathways member, then as a pending user, then as an Admin. Inspect the full rendered chrome for each. Confirm the member and pending sessions contain no administrative destination anywhere in navigation, and that navigation for each session matches what that session may actually open.

**Acceptance Scenarios**:

1. **Given** a member with no administrative role, **When** the shell renders on any authenticated page, **Then** no administrative destination appears anywhere in the chrome.
2. **Given** a pending user on the holding page, **When** the shell renders, **Then** they are not offered member destinations that would redirect them back to the holding page.
3. **Given** any session, **When** navigation is built, **Then** the roles used come from the signed session and a role value supplied by the browser has no effect on what navigation shows.
4. **Given** navigation omits a destination, **When** that route is requested directly, **Then** the existing authorization outcome is unchanged — hiding the entry is presentation, not enforcement.

---

### User Story 5 - The shell is usable by keyboard and assistive technology (Priority: P2)

Someone navigating by keyboard or screen reader lands on an authenticated page, skips directly to the main content, moves through navigation in a predictable order with a clearly visible focus indicator, and hears which destination is current. Someone who has asked their system to reduce motion sees no motion required to use the shell.

**Why this priority**: Constitution Principle V makes WCAG 2.1 AA a launch requirement. New persistent chrome that appears on every authenticated page is the highest-leverage place to get this right or wrong.

**Independent Test**: Using only a keyboard, load a member page, use the skip mechanism, tab through the shell, and activate a destination. Run the automated accessibility scan across member and administrative pages. Confirm zero violations on shell chrome, a visible focus indicator throughout, and a current-destination state exposed to assistive technology.

**Acceptance Scenarios**:

1. **Given** a keyboard user on any authenticated page, **When** they begin tabbing, **Then** a mechanism to skip past navigation to the main content is available before the navigation entries.
2. **Given** a keyboard user moving through the shell, **When** each control receives focus, **Then** a focus indicator is visible and meets the required contrast against adjacent colors.
3. **Given** a screen reader user on any authenticated page, **When** they inspect the page, **Then** navigation, main content, and any complementary chrome are exposed as distinct landmarks with a correct heading order.
4. **Given** a screen reader user in navigation, **When** they reach the entry for the section they are viewing, **Then** it is announced as the current destination.
5. **Given** a user whose system requests reduced motion, **When** they use the shell, **Then** no motion is required to understand or operate navigation.

---

### Edge Cases

- A pending, deactivated, or denied user signs in — what chrome, if any, wraps the holding page, and does it offer anything they cannot reach?
- A destination that exists in the product but is not a primary navigation entry (for example active sessions, or an individual event) — which primary entry, if any, reads as current?
- PRD §B.4 lists a Forum destination that has no route in this phase — navigation must not offer a destination that cannot open.
- A display name long enough to overflow the identity area, or a name in a script with different metrics.
- A short viewport, such as a phone in landscape, where fixed top and bottom chrome consume a large share of the screen.
- A device that reserves the bottom screen edge for system gestures.
- A person who holds an administrative role but has not satisfied MFA for this session.
- The account area on a device with no hover and no pointer precision.
- A route that redirects (pending redirect, MFA redirect) — chrome must not flash a navigation state the user cannot use.
- A member who has opted out of the directory — self-identity in chrome must not be governed by the directory visibility choice, which concerns other viewers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every authenticated member destination MUST render inside a shared shell providing primary navigation, an account area, and a single main content region.
- **FR-002**: At desktop widths the shell MUST present persistent side navigation; at mobile widths it MUST present bottom navigation plus a compact top bar. Exactly one primary navigation pattern MUST be operable at a time.
- **FR-003**: Primary navigation MUST list only destinations that exist and that the signed-in person's roles permit. A destination with no route in this phase MUST NOT appear.
- **FR-004**: The navigation entry corresponding to the current section MUST be marked as current, including on detail pages beneath that section, and MUST NOT rely on color as the only distinguishing signal.
- **FR-005**: The current-destination state MUST be exposed to assistive technology, not conveyed visually alone.
- **FR-006**: The shell MUST provide an account area containing the account destinations that exist today — directory privacy, active sessions, and sign out — reachable from every authenticated page.
- **FR-007**: For a session holding an administrative role, the account area MUST include an administrative entry point. For a session without one, no administrative destination may appear anywhere in the rendered chrome.
- **FR-008**: Administrative screens MUST use the same shell pattern and token set as member screens, and MUST NOT require the user to switch into an exclusive administrative mode to reach member destinations.
- **FR-009**: Navigation MUST be derived from the signed session's roles on the server. A role value supplied by the browser MUST have no effect on what navigation renders.
- **FR-010**: Hiding a destination from navigation MUST NOT be the mechanism that prevents access. Every existing route-level and data-level authorization outcome MUST remain unchanged.
- **FR-011**: The shell MUST provide a mechanism, available before the navigation entries in reading and focus order, to move directly to the main content.
- **FR-012**: The shell MUST use semantic landmarks for navigation and main content, and MUST preserve a correct heading order on every page it wraps.
- **FR-013**: Every interactive control in the shell MUST have a hit area of at least 44×44 CSS pixels and a visible focus indicator meeting at least 3:1 contrast against adjacent colors.
- **FR-014**: Shell text MUST meet at least 4.5:1 contrast for body text and at least 3:1 for large text and interactive boundaries, in both the default appearance and the dark system appearance.
- **FR-015**: At 360px width no authenticated page may scroll horizontally, and page content MUST remain fully readable and reachable when fixed chrome is present, including on devices that reserve a bottom safe area.
- **FR-016**: The shell MUST honor a reduced-motion preference; no motion may be required to understand or operate navigation.
- **FR-017**: All color, type, spacing, radius, elevation, and motion values in the shell MUST come from the existing token set. No new hard-coded visual values and no new token values may be introduced. Where the token set already defines a value that the theme layer does not yet make available to components, exposing that existing value is in scope and is not a new token.
- **FR-018**: The shell MUST identify the signed-in person using data the product already holds, limited to display name and program role. Email address, DOC affiliation, and title MUST NOT appear in persistent chrome.
- **FR-019**: A user in a restricted status, such as pending, MUST NOT be offered destinations that would immediately redirect them away.
- **FR-020**: Primary navigation MUST be operable without client-side scripting, so that moving between destinations works from first paint and does not wait on interactive code to load.
- **FR-021**: This slice MUST NOT add persisted data, audit actions, analytics events, or outbound requests.
- **FR-022**: Existing permission, route, and accessibility suites for `002`–`010` MUST pass unchanged, and tests proving the shell's role-awareness and accessibility MUST be written before the shell is built, per Constitution Principle IV.
- **FR-023**: Each primary navigation entry MUST pair a text label with a consistent visual marker, so a destination is identifiable at a glance in bottom navigation where labels are small. The marker MUST be decorative to assistive technology; the label MUST never be replaced by it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any authenticated page, at both 360px and desktop widths, every primary destination available to that person is reachable in a single action without opening a menu.
- **SC-002**: 100% of interactive controls in the shell measure at least 44×44 CSS pixels.
- **SC-003**: The automated accessibility scan reports zero violations attributable to shell chrome across member and administrative pages, in both default and dark system appearances.
- **SC-004**: Across every authenticated page, a session with no administrative role produces zero occurrences of an administrative destination in the rendered output.
- **SC-005**: 100% of primary destinations, including detail pages beneath a section, resolve to exactly one navigation entry marked as current.
- **SC-006**: At 360px, zero authenticated pages permit horizontal scrolling, and zero pages leave final content obscured by fixed chrome.
- **SC-007**: Every authorization outcome recorded by the existing permission suites is identical before and after this slice — zero changes in who may open what.
- **SC-008**: A keyboard-only user can reach main content from page load in at most one action, and can reach every primary destination without a pointer.
- **SC-009**: Zero hard-coded color, font, radius, or spacing values appear in shell chrome; every value resolves through the existing token set.
- **SC-010**: The authenticated shell remains within the platform's stated interface performance budget, with largest contentful paint at or below 2.5 seconds at the 75th percentile on a mid-range phone over a 4G connection.

## Assumptions

- **Forum is omitted.** PRD §B.4 lists a Forum destination, but forum work is a later phase and `/app/forum` has no route. Offering it would produce a dead entry, so it is left out until that slice ships, at which point adding it is a navigation data change rather than a shell change.
- **Bottom bar composition follows what exists.** PRD §7 describes "the primary 4 actions … with a hamburger for secondary items" while PRD §B.4 lists six entries including Forum and a profile menu. With Forum absent, the built destinations resolve to a small enough set that a secondary overflow menu is not required for primary navigation; account actions live in the account area rather than the primary bar. This is recorded as an assumption because the two PRD passages differ.
- **The mockup is the structural source, as it was the token source.** `/mockup` supplies the shell's structure and visual language. Its placeholder brand name and sample member data are not carried over; the product's own name and the signed-in person's own data are used.
- **Unauthenticated pages are unchanged.** Sign-in, registration, invitation completion, and password reset keep their current centered layout; they already inherit `008` tokens.
- **Page bodies are unchanged.** Pages inherit the frame. No page's content, copy, fields, or layout inside the main region is redesigned in this slice.
- **Self-identity in chrome is not governed by directory privacy.** The `007` directory privacy choice controls what *other* members see. Showing signed-in people their own name and role helps confirm whose session is active on a shared device.
- **No new token values.** If the shell needs a value the token set lacks, that is a finding to raise, not a license to hard-code.
- **The existing token set already supports the shell.** The mockup's shell relies on layout, sidebar, elevation, and target-size tokens that `008` extracted, so no token work is expected as a prerequisite. A small number of those extracted values are defined but not yet reachable from components; connecting them is wiring, not new design (see Appendix).
- **Navigation markers require an icon set the product does not yet include.** The mockup pairs every navigation entry with an icon, and bottom navigation is hard to scan without one. No icon set is currently part of the product, so FR-023 implies adding one. That is a new dependency and needs an explicit YAGNI justification at planning time rather than a silent addition.
- **The mockup's own naming is not authoritative where the product already chose one.** Where the mockup and the shipped codebase express the same concept differently, the shipped convention wins, so the shell does not introduce a second vocabulary for something already settled.
- **Resource cards keep the authenticated thumbnail.** The mockup shows a format glyph because its fixtures have no uploaded images. `004-resource-library` requires the card to show the thumbnail through `GET /app/resources/[id]/thumbnail`. The format tile is the fallback under the `<img>`, not a replacement. See [research.md](./research.md) §14.
- **Dark appearance is inherited, not designed.** The shell must remain accessible when the operating system requests dark appearance, using the dark values `008` already defines. No in-app switcher is added.

## Dependencies

- `008-design-tokens` — supplies every visual value this slice consumes; this slice adds none.
- `002-auth-rbac` — supplies the signed session, role claims, and the MFA gate that navigation must respect without duplicating.
- `003`–`010` — supply the destinations the shell navigates to and the suites that must continue to pass unchanged.
- PRD Appendix §B.2 and §B.4 define the destination list; a future forum slice extends it.
- An icon set, not currently part of the product, is implied by FR-023. See Assumptions.

---

## Appendix: porting findings for planning *(non-normative)*

Recorded during specification so `/speckit-plan` does not rediscover them. These are observations about the current codebase, not requirements. Nothing here changes the requirements above.

The mockup's shell cannot be copied verbatim. Four concrete mismatches:

1. **Sidebar theme keys are incomplete.** `app/tokens.css` defines the full sidebar set that `008` extracted, including `--sidebar-accent-foreground` and `--sidebar-primary-foreground`. But the `sidebar` group in `tailwind.config.ts` exposes only `DEFAULT`, `foreground`, `primary`, `accent`, `border`, and `ring`. The mockup's active navigation item uses `text-sidebar-accent-foreground`, which currently resolves to nothing. FR-017 covers this: the value exists, so exposing it is wiring.

2. **Tap-target utilities are spelled differently.** The mockup writes `min-h-tap` / `h-tap` / `w-tap`; the shipped codebase standardized on `min-h-touch` / `min-w-touch`, and `tests/unit/shared-chrome.test.ts` asserts those spellings. Both trace to `--tap-target`. Per the naming assumption above, the shipped spelling wins.

3. **Icons come from `lucide-react`, which is not a dependency.** `mockup/src/data/navigation.ts` and both navigation components import from it. This is the dependency FR-023 implies.

4. **Some mockup destinations have no route.** The mockup navigates to `/forum` and to a `/profile` index. The product has no forum route, and profile exists only as `/app/profile/privacy` and `/app/profile/sessions`. The mockup's brand string, "Bridgewell Institute", is placeholder text.

Also worth carrying forward: the mockup's Dashboard is assembled from `BlogSidebar` (PRD §5.8, unbuilt) and `ForumActivityList` (later phase) over sample data in `mockup/src/data/portal.ts`. Page bodies are out of scope, so member home keeps its current content and gains only the frame.
