# Contract: Token manifest

**Source of copy**: `mockup/src/styles/tokens.css`  
**Runtime file**: `app/tokens.css`  
**Imported from**: `app/globals.css`

## Required custom properties

`app/tokens.css` MUST define every name below on `:root`. Dark media MUST override the **semantic color** subset (not primitives) using the mockup `:root.dark` values.

### Primitives

`--stone-50`, `--stone-100`, `--stone-200`, `--stone-300`, `--stone-400`, `--stone-500`, `--stone-600`, `--stone-700`, `--stone-800`, `--stone-900`  
`--evergreen-50`, `--evergreen-100`, `--evergreen-300`, `--evergreen-600`, `--evergreen-700`, `--evergreen-800`  
`--clay-50`, `--clay-100`, `--clay-600`, `--clay-700`  
`--status-success`, `--status-warning`, `--status-danger`, `--status-info`, `--white`

### Semantic color

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`  
`--primary`, `--primary-hover`, `--primary-foreground`, `--primary-subtle`, `--primary-subtle-foreground`  
`--support`, `--support-foreground`, `--support-subtle`, `--support-subtle-foreground`  
`--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`  
`--accent`, `--accent-foreground`  
`--destructive`, `--destructive-foreground`  
`--success`, `--success-subtle`, `--warning`, `--warning-subtle`, `--info`, `--info-subtle`  
`--border`, `--border-strong`, `--input`, `--ring`  
`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`  
`--chart-1` … `--chart-5`

### Type, space, radius, elevation, focus, motion

`--font-body`, `--font-heading`, `--font-mono`  
`--text-eyebrow`, `--leading-eyebrow`, `--tracking-eyebrow`  
`--text-xs` … `--text-4xl` and matching `--leading-*`  
`--weight-normal`, `--weight-medium`, `--weight-semibold`, `--weight-bold`  
`--space-px`, `--space-0-5` … `--space-24`, `--tap-target`, `--gutter`, `--gutter-lg`, `--content-max`  
`--radius-xs`, `--radius-sm`, `--radius`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-full`  
`--shadow-none`, `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-bar`  
`--focus-width`, `--focus-offset`  
`--duration-fast`, `--duration-base`, `--ease-standard`

## Drift lock

Light `--primary` MUST equal mockup `--evergreen-700` (`#1f4d3f`). Light `--background` MUST equal mockup `--stone-100` (`#f4f1eb`). Asserted in `tests/unit/design-tokens.test.ts`.

## Forbidden

- HSL channel triplets as token values (`174 62% 24%`)
- Runtime `@import` of `fonts.googleapis.com`
- Importing `mockup/**` from the Next app CSS
