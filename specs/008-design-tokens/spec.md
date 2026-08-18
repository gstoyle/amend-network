# Feature Specification: Design Tokens

**Feature Branch**: `008-design-tokens`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Start slice 008-design-tokens. This is an infrastructure/polish slice, not a PRD feature slice: extract design tokens (colors, typography, spacing, radii) from the mockup files in /mockup into tokens.css per Constitution V and PRD §7's brand-parity strategy, wire them through the existing Tailwind theme config, and apply them to shared/reused components already built across slices 002-007 (buttons, form fields, cards, nav, layout chrome) so those slices inherit the new look without per-page rewrites. Do not change component structure or behavior, only tokens and styling."

**Cites**: Constitution v1.0.0 Principle V (Accessible, Token-Driven Interface); PRD v1.1 §7 Brand parity strategy (design tokens as CSS custom properties in a single `tokens.css`; theme utilities stay semantic; component library themed entirely through tokens; no hard-coded color or font values); PRD §7 contrast and 44×44 target rules; slices `002-auth-rbac` through `007-member-directory` as the surfaces that MUST inherit tokens. **Not** a PRD product-capability slice: no new member or staff journey.

## Scope

This slice makes the Member Network **look like Amend** on the screens already shipped, by adopting the mockup’s visual language as the single brand token set. Today those screens use placeholder theme values. The mockup already defines the intended palette, type scale, spacing, and radii. This slice **extracts** that set into the platform token file and **applies** it to shared, reused controls and chrome so login, registration, member app, and admin chrome pick up the look without rewriting each page.

It is a **visual-source-of-truth** slice, not a new feature. Structure, copy, fields, navigation destinations, authorization, and data behavior MUST stay as they are. Only appearance changes.

**In scope**

- A single brand token file covering colors, typography (scale, weight, family), spacing, and radii, taken from the mockup token set (including elevation, focus, and motion values already defined there so the set is not split)
- Wiring those tokens through the existing theme configuration so semantic utilities (`primary`, `background`, `card`, heading/body type, radius, space) resolve to mockup values
- Applying tokens to **shared, reused** controls and chrome already built in slices 002–007: buttons, form fields, cards, navigation, and layout chrome (shell, sidebar or header, page frame)
- Replacing hard-coded color, font, radius, or spacing on those shared pieces with token references
- Keeping WCAG 2.1 AA: body text ≥ 4.5:1, large text / interactive boundaries / focus ≥ 3:1, interactive targets ≥ 44×44 CSS pixels, `prefers-reduced-motion` respected
- Light theme as the default shipped look; OS-level dark preference continues to map to the mockup’s dark token values (no in-app theme switcher)
- Proof that existing permission, route, and accessibility suites for 002–007 still pass after the restyle

**Out of scope**

- New screens, new components, new navigation patterns, or a mobile bottom bar (PRD §7 bottom-bar IA is not this slice)
- Changing component structure, markup roles, form behavior, validation, copy, or any data/authorization path
- Per-page visual redesign of unique layouts; pages inherit the look because they use shared chrome and semantic utilities, not because each page is restyled
- The WordPress brand-team `tokens.json` manifest and build-time conversion script (PRD §7 layer 2). The mockup token set is the stand-in until that delivery exists
- Brand photography, illustration, or empty-state art
- Changing the mockup itself except as the source to copy from
- An in-app light/dark toggle, user-selectable themes, or a second brand for LEAD vs Pathways
- Production host, fonts hosted as a new product feature, or any backend/schema work

## User Scenarios & Testing *(mandatory)*

Primary actors: **signed-in members**, **staff (Admin / Super Admin / Moderator)**, **invited or registering visitors** (login and registration chrome), and a **brand steward** who later changes a token without a redesign pass.

### User Story 1 - Shared chrome looks like Amend (Priority: P1)

A member or staff member opens any already-shipped screen (sign-in, registration, member home, resources, announcements, events, directory, profile privacy, admin chrome). Buttons, fields, cards, navigation, and the page frame use the mockup’s warm stone surfaces, evergreen accent, type scale, spacing, and corner radii. The screens still have the same layout, labels, and actions as before; they look like a continuation of Amend, not a generic placeholder theme.

**Why this priority**: Brand parity is the reason this polish slice exists. Shared chrome is what every later page inherits.

**Independent Test**: Open sign-in, a member list or card page, and the member navigation/shell. Confirm colors, type, spacing, and corners match the mockup’s equivalent chrome (not the previous placeholder teal/gray). Confirm the same fields and links are present.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor on sign-in, **When** they view the page, **Then** the form fields, primary button, and page background use the mockup brand colors, type, spacing, and radii — not the previous placeholder theme.
2. **Given** a signed-in member on a screen that uses cards and navigation (for example home, resources, directory), **When** they view the page, **Then** cards, nav, and layout chrome match the mockup visual language while the same content and links remain.
3. **Given** a staff member on an admin-framed screen already in the product, **When** they view layout chrome and shared controls, **Then** those pieces use the same token set as the member app (one brand, not a second admin skin).
4. **Given** any shared button, field, card, nav item, or layout chrome, **When** a reviewer inspects appearance sources, **Then** color, type, radius, and spacing come from the brand token set, not one-off values on that control.

---

### User Story 2 - Brand change is a token change, not a restyle (Priority: P1)

A brand steward (or engineer acting as one) updates a semantic token — for example primary color or body type size — in the single token file. After refresh, every shared button, field, card, nav, and layout chrome that uses that token updates. No shared component and no page from 002–007 needs a one-off edit for that brand change.

**Why this priority**: PRD §7 and Constitution V exist so Amend can absorb a late WordPress brand delivery without a redesign pass. This slice must make that true for shipped chrome.

**Independent Test**: Change one semantic token (primary or background). Reload sign-in and a member shell page. Both reflect the new value on shared controls without editing those screens.

**Acceptance Scenarios**:

1. **Given** the platform token file as the only brand source, **When** the primary color token changes, **Then** shared primary buttons and other primary-accent chrome update on sign-in and member/admin shells without editing those screens.
2. **Given** a spacing or radius token change, **When** shared cards, fields, and layout chrome are viewed, **Then** they reflect the new spacing or corner value.
3. **Given** a later WordPress brand delivery, **When** that delivery is expressed as an update to the same token file, **Then** this slice’s wiring is sufficient for shared chrome — no second theme system.

---

### User Story 3 - Behavior and accessibility stay the same (Priority: P2)

A member completes an existing journey (sign-in, open a resource, search the directory, submit a form). Steps, errors, permissions, and data are unchanged. Text remains readable, controls remain large enough to tap, focus remains visible, and reduced-motion preference is still honored. The restyle MUST NOT introduce a failed accessibility scan on the chrome this slice touches.

**Why this priority**: Polish that breaks a journey or WCAG is not shippable. Constitution V is still in force.

**Independent Test**: Run existing permission and accessibility suites for 002–007. Walk sign-in and one member form at 360px width. Confirm no new steps, no lost labels, tap targets still ≥ 44×44, contrast still meets the stated ratios.

**Acceptance Scenarios**:

1. **Given** any journey that worked in slices 002–007, **When** a user completes it after this slice, **Then** the same steps, fields, and outcomes occur (no added clicks, no removed controls, no changed authorization).
2. **Given** body text on shared chrome against its background, **When** contrast is measured, **Then** it is at least 4.5:1; large text, interactive boundaries, and focus indicators are at least 3:1.
3. **Given** a shared button, nav control, or form control, **When** its hit area is measured, **Then** it is at least 44×44 CSS pixels.
4. **Given** `prefers-reduced-motion: reduce`, **When** the user views shared chrome, **Then** decorative motion is not required to use the screen.
5. **Given** the existing automated accessibility and permission proofs, **When** they run after the restyle, **Then** they still pass.

---

### Edge Cases

- A page from 002–007 that uses shared chrome plus a unique layout: shared pieces restyle; the unique layout is not redesigned, and MUST NOT be rewritten “to match the mockup page” if that would change structure.
- A leftover hard-coded color or spacing on a **shared** control: it MUST be replaced with a token. A one-off on a unique page block is out of scope unless that block is actually a reused control.
- Dark OS preference: appearance follows the mockup’s dark token values for the same semantic names. There is no separate “staff dark theme.”
- Missing mockup equivalent (a control the mockup never showed): use the semantic token that already names that role (primary, muted, destructive, card) rather than inventing a new one-off color.
- Token file and theme wiring disagree (utility still pointing at placeholder values): that is a defect; shared chrome MUST resolve to the mockup token set.
- Reduced motion and high contrast OS settings: existing reduced-motion behavior remains; this slice does not add a new high-contrast theme.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform MUST use a single brand token file whose color, typography, spacing, and radius values are taken from the mockup token set (including the mockup’s elevation, focus, and motion tokens so the set stays whole).
- **FR-002**: The existing theme configuration MUST read those tokens so semantic appearance names used by shared components (background, foreground, primary, card, muted, destructive, border, radius, type, space) resolve to mockup values, not the previous placeholder theme.
- **FR-003**: Shared, reused buttons, form fields, cards, navigation, and layout chrome from slices 002–007 MUST take color, type, radius, and spacing only from that token set. Hard-coded appearance values on those pieces are forbidden.
- **FR-004**: Pages from slices 002–007 MUST inherit the new look through those shared pieces and semantic utilities. This slice MUST NOT restyle pages one-by-one or change their structure.
- **FR-005**: Component structure, roles, labels, validation, navigation targets, and all authorization or data behavior MUST remain unchanged.
- **FR-006**: After the restyle, body text contrast MUST be at least 4.5:1; large text, interactive boundaries, and focus indicators MUST be at least 3:1; interactive targets on shared controls MUST remain at least 44×44 CSS pixels.
- **FR-007**: `prefers-reduced-motion` MUST continue to be honored on shared chrome.
- **FR-008**: The default appearance MUST be the mockup light theme. When the operating system requests a dark appearance, semantic tokens MUST follow the mockup dark values. The product MUST NOT add an in-app theme switcher in this slice.
- **FR-009**: Staff and member shared chrome MUST use the same token set (one Amend look).
- **FR-010**: Existing automated permission and accessibility proofs covering slices 002–007 MUST still pass after this slice.
- **FR-011**: A change to a semantic token in the single token file MUST update every shared control that uses that token without editing those controls.

### Key Entities

- **Brand token set**: Named visual values for color (primitive and semantic), type (size, line height, weight, family), space, radius, elevation, focus, and motion. Semantic names are what screens consume (`primary`, `card`, `muted`); primitives are raw palette steps the semantics point at.
- **Shared control**: A button, form field, card, nav item, or layout chrome piece reused across 002–007. In scope for restyle.
- **Placeholder theme**: The current generic appearance on those screens. Replaced for shared chrome; not a second theme to keep.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a side-by-side check of sign-in, member shell (nav + a card page), and admin chrome against the mockup’s equivalent chrome, a reviewer can confirm the same surface, accent, type scale, spacing, and corners — not the previous placeholder look — without any page being structurally rewritten.
- **SC-002**: Changing one semantic token (primary color or equivalent) causes shared buttons and accent chrome on at least two different existing screens to update, with zero edits to those screens.
- **SC-003**: 100% of shared buttons, form fields, cards, nav, and layout chrome use the brand token set for color, type, radius, and spacing (zero hard-coded appearance values on those pieces).
- **SC-004**: 100% of existing automated permission and accessibility suites for slices 002–007 still pass after the restyle.
- **SC-005**: Body text on restyled chrome meets at least 4.5:1 contrast; interactive boundaries and focus meet at least 3:1; shared interactive targets remain at least 44×44 CSS pixels.
- **SC-006**: A tester can complete sign-in and one member form journey with the same number of steps and the same outcomes as before the restyle.

## Assumptions

- The mockup token set (the “Quiet Institution” palette and type/space/radius scale in `/mockup`) is the current Amend brand source for this platform. The WordPress brand team has not delivered a `tokens.json` manifest; PRD §7 layer 2 (manifest + conversion script) waits for that delivery. This slice implements layer 1 (`tokens.css`) and applies it through the existing theme (layer 3: components themed through tokens).
- Naming `tokens.css` and the existing theme configuration is mandated reuse of Constitution V and PRD §7, not a new stack choice.
- Shadows, focus rings, and motion durations in the mockup token file ship with the set so later brand updates stay in one file; the user-facing scope remains colors, typography, spacing, and radii.
- Type families named in the mockup token set are in scope as token values; this slice does not add a new marketing font program beyond what that set already names.
- OS `prefers-color-scheme: dark` should keep working, mapped to the mockup’s dark semantic values, because the product already responds to that preference. No user-facing theme control.
- Unique page layouts from 002–007 that already use semantic utilities inherit automatically; leftover one-off appearance on non-shared page blocks is not a blocker for this slice.
- No LEAD vs Pathways visual fork; role is not expressed as a second palette on shared chrome (status/support colors in the mockup token set may be used for status, not for role skins).
- Accessibility scans already in the repo remain the proof for WCAG on restyled chrome; this slice does not invent a new audit program.
- Behavior-identical means permission matrices, search, audit events, and form validation do not change; visual differences alone are expected.
