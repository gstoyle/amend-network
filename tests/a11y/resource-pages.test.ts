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

describe("axe-core on resource library pages (T044)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("/app/resources has labeled search, filters, and sort", async () => {
    await expectNoViolations(
      "Resources",
      `<header>
        <nav aria-label="Member"><a href="/app">Home</a><a href="/app/resources">Resources</a></nav>
        <nav aria-label="Account"><button type="button">Log out</button></nav>
      </header>
      <main>
        <h1>Resources</h1>
        <form method="get">
          <label for="resource-q">Search</label>
          <input id="resource-q" name="q" type="search" />
          <fieldset>
            <legend>Tags</legend>
            <label><input name="tag" type="checkbox" value="guide" />guide</label>
          </fieldset>
          <label for="resource-source">Source</label>
          <select id="resource-source" name="source">
            <option value="">All sources</option>
            <option value="Amend">Amend</option>
          </select>
          <label for="resource-sort">Sort</label>
          <select id="resource-sort" name="sort">
            <option value="newest">Newest</option>
            <option value="downloads">Most downloaded</option>
            <option value="title">Alphabetical</option>
          </select>
          <button type="submit">Apply</button>
        </form>
        <ul>
          <li>
            <article>
              <a href="/app/resources/example">
                <img alt="" src="/app/resources/example/thumbnail" />
                <h2>Example resource</h2>
                <p>Preview text</p>
              </a>
            </article>
          </li>
        </ul>
      </main>`,
    );
  });

  it("/app/resources/[id] video uses in-page player without a storage URL", async () => {
    await expectNoViolations(
      "Example video",
      `<header>
        <nav aria-label="Member"><a href="/app">Home</a><a href="/app/resources">Resources</a></nav>
        <nav aria-label="Account"><button type="button">Log out</button></nav>
      </header>
      <main>
        <p><a href="/app/resources">Back to resources</a></p>
        <img alt="" src="/app/resources/example/thumbnail" />
        <h1>Example video</h1>
        <p>Preview text</p>
        <p>Last updated 2026-08-17</p>
        <video aria-label="Resource video" controls src="/app/resources/example/file">
          Your browser cannot play this video.
        </video>
      </main>`,
    );
  });

  it("/app/resources/[id] non-video uses download", async () => {
    await expectNoViolations(
      "Example PDF",
      `<main>
        <p><a href="/app/resources">Back to resources</a></p>
        <h1>Example PDF</h1>
        <p>Last updated 2026-08-17</p>
        <p><a href="/app/resources/example/download">Download</a></p>
      </main>`,
    );
  });

  it("/admin/resources lists withdrawn state", async () => {
    await expectNoViolations(
      "Resources",
      `<main>
        <h1>Resources</h1>
        <p><a href="/admin/resources/new">Publish a resource</a></p>
        <ul>
          <li>
            <p><a href="/admin/resources/example">Live resource</a></p>
            <p>Amend · all_authenticated</p>
          </li>
          <li>
            <p><a href="/admin/resources/withdrawn">Withdrawn resource</a></p>
            <p>Amend · all_authenticated · withdrawn</p>
          </li>
        </ul>
      </main>`,
    );
  });

  it("/admin/resources/new uses labeled publish fields", async () => {
    await expectNoViolations(
      "Publish a resource",
      `<main>
        <h1>Publish a resource</h1>
        <form>
          <label for="title">Title</label><input id="title" name="title" type="text" />
          <label for="previewText">Preview text</label><textarea id="previewText" name="previewText"></textarea>
          <label for="sourceLabel">Source</label>
          <select id="sourceLabel" name="sourceLabel"><option value="Amend">Amend</option></select>
          <label for="tags">Tags (comma-separated, up to 10)</label><input id="tags" name="tags" type="text" />
          <fieldset>
            <legend>Visibility</legend>
            <label><input name="visibility" type="checkbox" value="all_authenticated" />Everyone signed in</label>
          </fieldset>
          <label for="file">File</label><input id="file" name="file" type="file" />
          <label for="thumbnail">Thumbnail</label><input id="thumbnail" name="thumbnail" type="file" />
          <button type="submit">Publish resource</button>
        </form>
      </main>`,
    );
  });

  it("/admin/resources/[id] edit and withdraw are labeled", async () => {
    await expectNoViolations(
      "Edit resource",
      `<main>
        <h1>Edit resource</h1>
        <p><a href="/admin/resources">Back to resources</a></p>
        <form>
          <input name="resourceId" type="hidden" value="example" />
          <label for="title">Title</label><input id="title" name="title" type="text" />
          <label for="previewText">Preview text</label><textarea id="previewText" name="previewText"></textarea>
          <label for="sourceLabel">Source</label>
          <select id="sourceLabel" name="sourceLabel"><option value="Amend">Amend</option></select>
          <label for="tags">Tags (comma-separated, up to 10)</label><input id="tags" name="tags" type="text" />
          <fieldset>
            <legend>Visibility</legend>
            <label><input name="visibility" type="checkbox" value="all_authenticated" />Everyone signed in</label>
          </fieldset>
          <label for="file">Replacement file (optional)</label><input id="file" name="file" type="file" />
          <label for="thumbnail">Replacement thumbnail (optional)</label>
          <input id="thumbnail" name="thumbnail" type="file" />
          <button type="submit">Save</button>
        </form>
        <form>
          <input name="resourceId" type="hidden" value="example" />
          <button type="submit">Withdraw resource</button>
        </form>
      </main>`,
    );
  });
});
