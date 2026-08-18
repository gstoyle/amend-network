# Contract: Contrast pairs

Measure from resolved token values in `app/tokens.css` (light `:root` and dark media). WCAG 2.1 AA. Constitution V.

## Light (`:root`)

| Foreground | Background | Minimum |
| --- | --- | --- |
| `--foreground` | `--background` | 4.5:1 |
| `--muted-foreground` | `--background` | 4.5:1 |
| `--primary-foreground` | `--primary` | 4.5:1 |
| `--secondary-foreground` | `--secondary` | 4.5:1 |
| `--destructive-foreground` | `--destructive` | 4.5:1 |
| `--card-foreground` | `--card` | 4.5:1 |
| `--ring` (focus) vs `--background` | — | 3:1 |
| `--border-strong` vs `--background` | — | 3:1 |

## Dark (`prefers-color-scheme: dark` overrides)

Same pairs against the dark semantic values from the mockup `:root.dark` block.

## Tap target

`--tap-target` MUST be `2.75rem` (44px). `min-h-touch` / `min-w-touch` MUST use that token.

## Proof

`tests/unit/design-tokens.test.ts` computes relative luminance from parsed hex/rgb (resolve `var(--stone-*)` chains). Existing `pnpm test:a11y` remains a landmark/label proof; axe `color-contrast` stays disabled in jsdom.
