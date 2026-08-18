# Data model: Design Tokens

**Feature**: `008-design-tokens` | **Date**: 2026-08-18

No database entities. The model is the **brand token set** (spec Key Entities). Values are copied from `mockup/src/styles/tokens.css` into `app/tokens.css`.

## Layers

```text
primitives (stone / evergreen / clay / status / white)
    → semantic color (background, primary, card, …)
    → theme utilities (bg-primary, text-foreground, …)
    → shared chrome (button, field, card, nav, layout)
```

A later WordPress `tokens.json` (PRD §7 layer 2, out of scope) would replace primitives/semantics in the same file; utilities and chrome stay.

## Primitive color

| Token | Role |
| --- | --- |
| `--stone-50` … `--stone-900` | Warm neutral scale |
| `--evergreen-50` … `--evergreen-800` | Accent scale |
| `--clay-50` … `--clay-700` | Support / status distinction |
| `--status-success`, `--status-warning`, `--status-danger`, `--status-info` | Status |
| `--white` | Card / popover fill (light) |

Primitives are **not** consumed by components. Components use semantics only.

## Semantic color (required)

Must exist on `:root` (light) and under `prefers-color-scheme: dark` (mockup dark values). Full list: [contracts/token-manifest.md](./contracts/token-manifest.md).

Validation:

- Body text: `--foreground` on `--background` ≥ 4.5:1
- Muted text: `--muted-foreground` on `--background` ≥ 4.5:1 (mockup comments 6.4:1 light)
- Primary button: `--primary-foreground` on `--primary` ≥ 4.5:1
- Destructive: `--destructive-foreground` on `--destructive` ≥ 4.5:1
- Borders / focus: `--border-strong` and `--ring` vs adjacent surfaces ≥ 3:1 where used as interactive boundaries

## Typography

| Token | Role |
| --- | --- |
| `--font-body`, `--font-heading`, `--font-mono` | Families (Geist via `next/font` variables + fallbacks) |
| `--text-*` / `--leading-*` | Scale xs–4xl plus eyebrow |
| `--weight-normal` … `--weight-bold` | 400–700 |
| `--tracking-eyebrow` | Eyebrow letter-spacing |

## Space and radius

| Token | Role |
| --- | --- |
| `--space-*` | 4px base scale |
| `--tap-target` | `2.75rem` (44px) — maps to `min-h-touch` / `min-w-touch` / `spacing.tap` |
| `--gutter`, `--gutter-lg`, `--content-max` | Layout chrome |
| `--radius-xs` … `--radius-full` | Corners; `--radius` is the default control radius |

## Elevation, focus, motion

Shipped with the mockup file so the set is not split: `--shadow-*`, `--focus-width`, `--focus-offset`, `--duration-fast`, `--duration-base`, `--ease-standard`.

## State

No workflow. Light is default. Dark semantic overrides apply only when the OS requests dark. No user-stored theme.

## Relationships

- Shared controls **must** reference semantic tokens (or theme utilities that resolve to them).
- Hard-coded hex / `rgb()` / `hsl()` on `components/ui/*` and layout chrome is forbidden.
- Changing a semantic token **must** update every shared control that uses that name (spec FR-011).
