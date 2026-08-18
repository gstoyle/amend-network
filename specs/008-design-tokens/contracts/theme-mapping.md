# Contract: Theme mapping

`tailwind.config.ts` MUST resolve semantic utilities through CSS variables (complete colors), not `hsl(var(--…))` channel wrappers.

## Colors (extend)

| Utility prefix | CSS variable |
| --- | --- |
| `background` / `foreground` | `--background` / `--foreground` |
| `card` / `card-foreground` | `--card` / `--card-foreground` |
| `popover` / `popover-foreground` | `--popover` / `--popover-foreground` |
| `primary` / `primary-foreground` / `primary-hover` / `primary-subtle` | `--primary` / `--primary-foreground` / `--primary-hover` / `--primary-subtle` |
| `secondary` / `muted` / `accent` / `destructive` | matching `--*` |
| `support` / `success` / `warning` / `info` | matching `--*` |
| `border` / `border-strong` / `input` / `ring` | matching `--*` |
| `sidebar` (+ foreground, primary, accent, border, ring) | matching `--sidebar*` |

Pattern: `"var(--token-name)"` (see `mockup/tailwind.config.js`). Nested `primary.DEFAULT` / `primary.foreground` / `primary.hover` is allowed.

## Type, space, radius, shadow, motion

| Theme key | Maps to |
| --- | --- |
| `fontFamily.sans` / `heading` / `mono` | `--font-body` / `--font-heading` / `--font-mono` |
| `fontSize.xs` … `4xl`, `eyebrow` | `--text-*` + `--leading-*` |
| `spacing` scale used by existing utilities (`1`–`24`, `px`, `0.5` …) | `--space-*` |
| `spacing.tap` | `--tap-target` |
| `minHeight.touch` / `minWidth.touch` | `--tap-target` (keep class names `min-h-touch` / `min-w-touch`) |
| `borderRadius.sm` … `xl` | `--radius-*` (do not keep `calc(var(--radius) - 2px)` once the mockup scale exists) |
| `boxShadow.sm` / `md` / `lg` | `--shadow-*` |
| `transitionDuration.fast` / `DEFAULT` | `--duration-*` |

Existing pages that use `p-6`, `text-sm`, `rounded-md`, `bg-primary` MUST pick up mockup values with **no class-name rewrites**.
