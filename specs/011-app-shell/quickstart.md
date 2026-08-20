# Quickstart: Authenticated App Shell (local)

Proves this slice in a **local** browser. No DreamHost. No new services. Unlike `010`, this one you actually look at.

## Prerequisites

Same as [../002-auth-rbac/quickstart.md](../002-auth-rbac/quickstart.md): Node 24, pnpm, Docker Postgres, `.env` from `.env.example`.

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
```

No new seed data. The shell renders around the pages `002`–`010` already ship.

## Automated validation

```bash
pnpm test
pnpm test:rls
pnpm test:a11y
pnpm typecheck
pnpm lint
```

`pnpm test:a11y` **is** required for this slice — it adds chrome to every authenticated page, which is exactly what Constitution Principle V's gate is for.

Expect:

- Unit `tests/unit/app-shell-nav.test.ts`: a member session yields zero administrative destinations; a pending session yields no member destinations; a claims object carrying a browser-supplied role changes nothing; `/app` matches only itself while `/app/events/<id>` marks Events current.
- Unit `tests/unit/app-shell.test.ts`: no hex, `rgb(`, `hsl(`, or `px` literal in any chrome file; `min-h-touch` present; landmarks present.
- a11y `tests/a11y/shell.test.ts`: zero axe violations on member and admin shell markup; skip link precedes navigation; the active entry carries `aria-current`.
- `tests/unit/a11y-lock.test.ts`: the sidebar accent pair clears its contrast floor in both light and dark values.
- `pnpm test:rls` unchanged at its existing count — this slice touches no policy. It runs to prove SC-007, that no authorization outcome moved.

## Manual inspection

```bash
pnpm dev
```

Sign in with a seeded member account, then walk this list:

1. **Desktop.** At a wide window, confirm the fixed left sidebar: brand, your name and program role, primary destinations, and the sign-out footer. Open Resources and confirm Resources is marked current. Open a single resource and confirm Resources is *still* marked current.
2. **Mobile.** Narrow the window below 1024px, or use device emulation at 360px. The sidebar is replaced by a top bar and a bottom tab bar. Scroll a long page to its end and confirm the last content is readable and not sitting under the bar. Try to scroll sideways — you should not be able to.
3. **Keyboard.** Reload and press Tab once. The first stop is the skip link. Activate it and confirm focus lands in main content. Tab through navigation and confirm the focus ring is visible on every entry.
4. **Role.** While signed in as a member with no administrative role, view source or use the element inspector and search the page for `/admin`. There should be no match anywhere in the document.
5. **Staff.** Sign in as an admin with MFA satisfied. Confirm an Admin entry appears in the account area, that administrative pages carry the same shell, and that member destinations are still present there.
6. **Pending.** Sign in as a pending user. The holding page should show brand, identity, and sign out — no destinations that would bounce you back.
7. **Appearance.** Switch the operating system between light and dark. The shipped default is light warm stone; dark uses the values `008` already defines. Both must stay legible.
8. **Reduced motion.** Turn on the OS reduce-motion setting and confirm nothing about navigation depends on animation.

## Comparing against the mockup

The mockup is a standalone Vite app with its own dependencies:

```bash
cd mockup
npm install
npm run dev
```

Open it beside `pnpm dev` and compare the frame. Expect deliberate differences, all recorded in [spec.md](./spec.md) Assumptions and the appendix there: no Forum entry, no `/profile` index, the product's own brand string instead of the mockup's placeholder, and page bodies unchanged — the mockup's dashboard is built from a blog feed and forum activity that do not exist yet.
