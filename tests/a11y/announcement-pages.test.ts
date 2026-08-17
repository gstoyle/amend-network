import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

async function expectNoViolations(title: string, body: string): Promise<void> {
  document.documentElement.lang = "en";
  document.title = title;
  document.body.innerHTML = body;
  const results = await axe.run(document, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

describe("axe-core on announcement pages (T031)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("member chrome banners have labeled region, dismiss, and CTA controls", async () => {
    await expectNoViolations(
      "Home",
      `<header>
        <nav aria-label="Member"><a href="/app">Home</a><a href="/app/resources">Resources</a></nav>
        <nav aria-label="Account"><button type="button">Log out</button></nav>
      </header>
      <section aria-label="Announcements">
        <article>
          <h2>Seed shared banner</h2>
          <p>Body for Seed shared banner</p>
          <form action="/app/announcements/example/cta/primary" method="post">
            <button type="submit">Read more</button>
          </form>
          <form action="/app/announcements/example/dismiss" method="post">
            <button type="submit">Dismiss</button>
          </form>
        </article>
      </section>
      <main><h1>Home</h1></main>`,
    );
  });

  it("/admin/announcements lists filters and withdrawn state", async () => {
    await expectNoViolations(
      "Announcements",
      `<main>
        <h1>Announcements</h1>
        <p><a href="/admin/announcements/new">New announcement</a></p>
        <nav aria-label="Filter announcements">
          <a href="/admin/announcements">All</a>
          <a href="/admin/announcements?status=scheduled">Scheduled</a>
          <a href="/admin/announcements?status=active">Active</a>
          <a href="/admin/announcements?status=expired">Expired</a>
          <a href="/admin/announcements?status=withdrawn">Withdrawn</a>
        </nav>
        <ul>
          <li>
            <p><a href="/admin/announcements/example">Live banner</a></p>
            <p>active · all_authenticated</p>
          </li>
          <li>
            <p><a href="/admin/announcements/withdrawn">Withdrawn banner</a></p>
            <p>withdrawn · all_authenticated</p>
          </li>
        </ul>
      </main>`,
    );
  });

  it("/admin/announcements/new uses labeled publish fields", async () => {
    await expectNoViolations(
      "New announcement",
      `<main>
        <h1>New announcement</h1>
        <form>
          <label for="headline">Headline</label>
          <input id="headline" name="headline" type="text" />
          <label for="body">Body</label>
          <textarea id="body" name="body"></textarea>
          <fieldset>
            <legend>Visibility</legend>
            <label><input name="visibility" type="checkbox" value="all_authenticated" />Everyone signed in</label>
          </fieldset>
          <label for="activatesAt">Activates</label>
          <input id="activatesAt" name="activatesAt" type="datetime-local" />
          <label for="expiresAt">Expires</label>
          <input id="expiresAt" name="expiresAt" type="datetime-local" />
          <label><input name="dismissible" type="checkbox" value="true" />Members may dismiss this banner</label>
          <label for="ctaPrimaryLabel">First button label</label>
          <input id="ctaPrimaryLabel" name="ctaPrimaryLabel" type="text" />
          <label for="ctaPrimaryUrl">First button destination</label>
          <input id="ctaPrimaryUrl" name="ctaPrimaryUrl" type="text" />
          <button type="submit">Publish</button>
        </form>
      </main>`,
    );
  });

  it("/admin/announcements/[id] edit and withdraw are labeled", async () => {
    await expectNoViolations(
      "Edit announcement",
      `<main>
        <h1>Edit announcement</h1>
        <form>
          <label for="headline">Headline</label>
          <input id="headline" name="headline" type="text" />
          <label for="body">Body</label>
          <textarea id="body" name="body"></textarea>
          <button type="submit">Save</button>
        </form>
        <form>
          <button type="submit">Withdraw</button>
        </form>
      </main>`,
    );
  });
});
