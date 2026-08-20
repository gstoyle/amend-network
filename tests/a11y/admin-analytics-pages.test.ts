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

describe("axe-core on admin analytics pages (T028 / SC-010)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("/admin KPI cards and staff links have labeled landmarks and 44px targets", async () => {
    await expectNoViolations(
      "Admin",
      `<header>
        <nav aria-label="Admin">
          <a class="inline-flex min-h-touch items-center" href="/admin">Home</a>
          <a class="inline-flex min-h-touch items-center" href="/admin/analytics">Analytics</a>
          <a class="inline-flex min-h-touch items-center" href="/admin/audit-log">Audit log</a>
        </nav>
      </header>
      <main>
        <h1>Admin</h1>
        <section aria-label="Platform health">
          <article><h2>Approved members</h2><p>12</p></article>
          <article><h2>Monthly active members</h2><p>8</p></article>
          <article><h2>Pending registrations</h2><p>2</p></article>
          <article><h2>Live content</h2><p>Resources 4</p></article>
        </section>
        <nav aria-label="User administration">
          <a class="inline-flex min-h-touch min-w-touch items-center" href="/admin/analytics">Analytics</a>
          <a class="inline-flex min-h-touch min-w-touch items-center" href="/admin/audit-log">Audit log</a>
        </nav>
      </main>`,
    );
    expect(read("app/(admin)/admin/page.tsx")).toContain("min-h-touch");
  });

  it("/admin/analytics funnel and leaderboards are labeled; filter control is 44px", async () => {
    await expectNoViolations(
      "Analytics",
      `<main>
        <h1>Analytics</h1>
        <section aria-label="Platform health">
          <article><h2>Approved members</h2><p>12</p></article>
        </section>
        <section aria-label="Join to return funnel">
          <form action="/admin/analytics" method="get">
            <label for="analytics-network">Network</label>
            <select class="min-h-touch" id="analytics-network" name="network">
              <option value="all">All networks</option>
            </select>
            <button class="min-h-touch min-w-touch" type="submit">Apply</button>
          </form>
          <ol>
            <li><h2>Invitation</h2><p>10</p></li>
            <li><h2>Registration</h2><p>8</p></li>
            <li><h2>Approval</h2><p>7</p></li>
            <li><h2>First login</h2><p>6</p></li>
            <li><h2>30-day retention</h2><p>3 of 5</p></li>
          </ol>
        </section>
        <section aria-label="Content engagement">
          <article>
            <h2>Top resources</h2>
            <ol><li>Guide 4</li></ol>
          </article>
          <article>
            <h2>Top events</h2>
            <ol><li>Workshop 5</li></ol>
          </article>
          <p>Forum ranking is deferred; it is not available.</p>
        </section>
      </main>`,
    );
    const funnelSource = read("components/admin-funnel.tsx");
    expect(funnelSource).toContain("Select");
    expect(funnelSource).toContain("Button");
  });

  it("/admin/audit-log filters, export, and table container-scroll at 360px", async () => {
    await expectNoViolations(
      "Audit log",
      `<main>
        <h1>Audit log</h1>
        <form action="/admin/audit-log" method="get">
          <label for="audit-actor">Actor</label>
          <input class="min-h-touch" id="audit-actor" name="actor" />
          <label for="audit-action">Action</label>
          <select class="min-h-touch" id="audit-action" name="action">
            <option value="">All actions</option>
          </select>
          <label for="audit-from">From</label>
          <input class="min-h-touch" id="audit-from" name="from" type="date" />
          <label for="audit-to">To</label>
          <input class="min-h-touch" id="audit-to" name="to" type="date" />
          <label for="audit-severity">Severity</label>
          <select class="min-h-touch" id="audit-severity" name="severity">
            <option value="">All severities</option>
          </select>
          <button class="min-h-touch min-w-touch" type="submit">Apply</button>
        </form>
        <form action="/admin/audit-log/export" method="post">
          <button class="min-h-touch min-w-touch" type="submit">Export CSV</button>
        </form>
        <div class="overflow-x-auto" role="region" aria-label="Audit log table" tabindex="0">
          <table>
            <caption>Audit log</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Actor</th>
                <th scope="col">Role</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Target</th>
                <th scope="col">IP</th>
                <th scope="col">User agent</th>
                <th scope="col">Severity</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="whitespace-nowrap">2026-08-18T00:00:00.000Z</td>
                <td class="whitespace-nowrap">00000000-0000-4000-8000-000000000001</td>
                <td class="whitespace-nowrap">admin</td>
                <td class="whitespace-nowrap">login_success</td>
                <td class="whitespace-nowrap">session</td>
                <td class="whitespace-nowrap"></td>
                <td class="whitespace-nowrap">127.0.0.1</td>
                <td class="whitespace-nowrap">vitest</td>
                <td class="whitespace-nowrap">info</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <a class="inline-flex min-h-touch items-center" href="/admin/audit-log?cursor=1">Next</a>
        </p>
      </main>`,
    );
    const page = read("app/(admin)/admin/audit-log/page.tsx");
    expect(page).toContain("overflow-x-auto");
    expect(page).toContain("whitespace-nowrap");
    expect(page).toContain("min-h-touch");
    expect(page).toContain('aria-label="Audit log table"');
    expect(read("components/audit-log-filters.tsx")).toContain("Select");
    expect(read("components/audit-log-export.tsx")).toContain("Button");
  });
});
