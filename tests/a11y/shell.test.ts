import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

async function expectNoViolations(title: string, body: string): Promise<void> {
  document.documentElement.lang = "en";
  document.title = title;
  document.body.innerHTML = body;
  const results = await axe.run(document, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

const SKIP_LINK = `<a class="sr-only focus:not-sr-only" href="#main-content">Skip to main content</a>`;

const ADMIN_GROUP = `<nav aria-label="Administration">
  <ul>
    <li><a class="flex min-h-touch items-center" href="/admin">Admin home</a></li>
    <li><a class="flex min-h-touch items-center" href="/admin/analytics">Analytics</a></li>
    <li><a class="flex min-h-touch items-center" href="/admin/audit-log">Audit log</a></li>
  </ul>
</nav>`;

function sidebar(adminGroup = ""): string {
  return `<aside aria-label="Member">
  <div><a href="/app">Amend Member Network<span>Member portal</span></a></div>
  <div><p>Ada Lovelace</p><p>Pathways to Change</p></div>
  <nav aria-label="Primary">
    <ul>
      <li><a aria-current="page" class="flex min-h-touch items-center" href="/app">Home</a></li>
      <li><a class="flex min-h-touch items-center" href="/app/resources">Resources</a></li>
      <li><a class="flex min-h-touch items-center" href="/app/events">Events</a></li>
      <li><a class="flex min-h-touch items-center" href="/app/directory">Directory</a></li>
    </ul>
  </nav>
  ${adminGroup}
  <nav aria-label="Account">
    <ul>
      <li><a class="flex min-h-touch items-center" href="/app/profile/privacy">Directory privacy</a></li>
      <li><a class="flex min-h-touch items-center" href="/app/profile/sessions">Active sessions</a></li>
    </ul>
    <form><button class="min-h-touch min-w-touch" type="submit">Log out</button></form>
  </nav>
</aside>`;
}

const SIDEBAR = sidebar();

const MAIN = `<main id="main-content"><h1>Home</h1><p>Signed in.</p></main>`;

const BOTTOM_BAR = `<nav aria-label="Primary" style="padding-bottom: env(safe-area-inset-bottom)">
  <ul>
    <li><a aria-current="page" class="flex min-h-touch flex-col" href="/app"><span aria-hidden="true"></span><svg aria-hidden="true" focusable="false"></svg>Home</a></li>
    <li><a class="flex min-h-touch flex-col" href="/app/resources"><span aria-hidden="true"></span><svg aria-hidden="true" focusable="false"></svg>Resources</a></li>
    <li><a class="flex min-h-touch flex-col" href="/app/events"><span aria-hidden="true"></span><svg aria-hidden="true" focusable="false"></svg>Events</a></li>
    <li><a class="flex min-h-touch flex-col" href="/app/directory"><span aria-hidden="true"></span><svg aria-hidden="true" focusable="false"></svg>Directory</a></li>
  </ul>
</nav>`;

const TOP_BAR = `<header>
  <a href="/app">Amend Member Network<span>Member portal</span></a>
  <a aria-label="Your account, Ada Lovelace" class="flex min-h-touch min-w-touch items-center" href="/app/profile/privacy">
    <span aria-hidden="true">AL</span>
  </a>
</header>`;

describe("app shell accessibility — desktop (T008 / US1)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("member sidebar shell has no axe violations", async () => {
    await expectNoViolations("Home", `${SKIP_LINK}${SIDEBAR}${MAIN}`);
  });

  it("the skip link is the first focusable element and precedes navigation", () => {
    document.body.innerHTML = `${SKIP_LINK}${SIDEBAR}${MAIN}`;
    const focusable = document.querySelectorAll("a[href], button");
    expect(focusable[0]?.getAttribute("href")).toBe("#main-content");
    const skipIndex = document.body.innerHTML.indexOf("#main-content");
    const navIndex = document.body.innerHTML.indexOf('aria-label="Primary"');
    expect(skipIndex).toBeLessThan(navIndex);
  });

  it("the skip link target exists as the main landmark", () => {
    document.body.innerHTML = `${SKIP_LINK}${SIDEBAR}${MAIN}`;
    const target = document.getElementById("main-content");
    expect(target?.tagName.toLowerCase()).toBe("main");
  });

  it("the current destination is announced, not signalled by colour alone", () => {
    document.body.innerHTML = SIDEBAR;
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute("href")).toBe("/app");
  });
});

describe("app shell source obligations (T008 / FR-011, FR-012)", () => {
  it("app-shell renders the skip link, one main landmark, and no heading", () => {
    const source = read("components/app-shell.tsx");
    expect(source).toContain("#main-content");
    expect(source).toContain('id="main-content"');
    expect(source).not.toContain("<h1");
  });

  it("the skip link meets the tap-target floor once revealed", () => {
    // Verified in a real browser: forcing :focus renders it at 168x44 at (16,16).
    const source = read("components/app-shell.tsx");
    expect(source).toContain("focus:min-h-touch");
    expect(source).toContain("focus:not-sr-only");
  });

  it("sidebar marks the current entry with aria-current and a token class", () => {
    const source = read("components/shell/desktop-sidebar.tsx");
    expect(source).toMatch(/aria-current=\{[^}]*"page"/);
    expect(source).toContain("bg-sidebar-accent");
    expect(source).toContain("text-sidebar-accent-foreground");
    expect(source).toContain("aria-label={label}");
    expect(source).toContain('label="Primary"');
    expect(source).toContain('label="Administration"');
    expect(source).toContain('aria-label="Account"');
  });

  it("sidebar navigation is a list of links", () => {
    const source = read("components/shell/desktop-sidebar.tsx");
    expect(source).toContain("<ul");
    expect(source).toContain("<li");
    expect(source).toContain("<Link");
  });
});

describe("app shell accessibility — mobile (T013 / US2)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("top bar and bottom bar shell has no axe violations", async () => {
    await expectNoViolations("Home", `${SKIP_LINK}${TOP_BAR}${MAIN}${BOTTOM_BAR}`);
  });

  it("every bottom bar item keeps a text label beside its decorative icon", () => {
    document.body.innerHTML = BOTTOM_BAR;
    const items = document.querySelectorAll("nav ul li a");
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      expect(item.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("the bottom bar marks exactly one current item", () => {
    document.body.innerHTML = BOTTOM_BAR;
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("the account control names the person rather than relying on initials", () => {
    document.body.innerHTML = TOP_BAR;
    const control = document.querySelector("[aria-label]");
    expect(control?.getAttribute("aria-label")).toContain("Ada Lovelace");
    expect(control?.querySelector("span")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("bottom bar source reserves the device safe area and labels its landmark", () => {
    const source = read("components/shell/bottom-tab-bar.tsx");
    expect(source).toContain("env(safe-area-inset-bottom)");
    expect(source).toContain('aria-label="Primary"');
    expect(source).toContain("lg:hidden");
  });
});

describe("app shell accessibility — admin (T019 / US3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("member and administrative groups coexist with distinct names", async () => {
    await expectNoViolations("Admin", `${SKIP_LINK}${sidebar(ADMIN_GROUP)}${MAIN}`);
    document.body.innerHTML = sidebar(ADMIN_GROUP);
    const names = [...document.querySelectorAll("nav")].map((nav) =>
      nav.getAttribute("aria-label"),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("Administration");
  });
});
