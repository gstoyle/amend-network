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

/**
 * Mirrors the markup the 012 page bodies emit. Contrast is covered by token pairs
 * in tests/unit/a11y-lock.test.ts, so it stays disabled here.
 */
describe("axe-core on member page layouts (012 T007)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const EVENT_ROW = `<li>
    <article>
      <p aria-hidden="true"><span>Aug</span><span>21</span></p>
      <p><span>Date and time: </span>Thursday 21 Aug · 10:00–12:30</p>
      <h3><a href="/app/events/example">De-escalation refresher</a></h3>
      <p>Online · Live session, recording provided</p>
      <p>
        <span>You are registered</span>
        <span>9 of 40 seats remaining</span>
        <span>All members</span>
      </p>
    </article>
  </li>`;

  it("home renders the two-column grid with a named reserved region", async () => {
    await expectNoViolations(
      "Home",
      `<main>
        <header>
          <p>Wednesday 19 August</p>
          <h1>Welcome back, Dana</h1>
          <p><span>LEAD</span> · Member since 2019</p>
        </header>
        <section aria-label="Upcoming events">
          <p>Training calendar</p>
          <h2 id="events-heading">Upcoming events</h2>
          <a href="/app/events">All events<span aria-hidden="true">→</span></a>
          <ul>${EVENT_ROW}</ul>
        </section>
        <section aria-labelledby="resources-heading">
          <p>Library</p>
          <h2 id="resources-heading">Recent resources</h2>
          <a href="/app/resources">All resources<span aria-hidden="true">→</span></a>
          <ul>
            <li>
              <img alt="" src="/app/resources/example/thumbnail" />
              <span aria-hidden="true">PDF</span>
              <p>National office</p>
              <h3><a href="/app/resources/example">Core practice guide</a></h3>
              <p>Updated 6 August 2026 <span>All members</span></p>
              <a aria-label="Download Core practice guide" href="/app/resources/example">
                <span aria-hidden="true"></span>
              </a>
            </li>
          </ul>
        </section>
        <section aria-labelledby="forum-heading">
          <p>Community</p>
          <h2 id="forum-heading">Recent forum activity</h2>
          <a href="/app/forum">All categories<span aria-hidden="true">→</span></a>
          <ul>
            <li>
              <a href="/app/forum/t/example">Welcome to the general room</a>
              <p>All members · Ada L. · 19 August 2026</p>
            </li>
          </ul>
        </section>
        <aside>
          <section aria-labelledby="reserved-heading">
            <p>From the blog</p>
            <h2 id="reserved-heading">Public writing</h2>
            <p>Amend's public writing is not published in the portal yet.</p>
          </section>
        </aside>
      </main>`,
    );
  });

  it("the resource filter band exposes chip checkboxes and a polite count", async () => {
    await expectNoViolations(
      "Resources",
      `<main>
        <header>
          <p>Library</p>
          <h1>Resources</h1>
        </header>
        <section aria-labelledby="resource-filters-heading">
          <h2 id="resource-filters-heading">Filter resources</h2>
          <form method="get">
            <label for="resource-q">Search resources</label>
            <span aria-hidden="true"></span>
            <input id="resource-q" name="q" type="search" />
            <label for="resource-source">Source</label>
            <select id="resource-source" name="source"><option value="">All sources</option></select>
            <label for="resource-sort">Sort</label>
            <select id="resource-sort" name="sort"><option value="newest">Newest</option></select>
            <fieldset>
              <legend>Filter by topic</legend>
              <label><input checked name="tag" type="checkbox" value="curriculum" />Curriculum</label>
              <label><input name="tag" type="checkbox" value="reentry" />Reentry</label>
            </fieldset>
            <button type="submit">Apply</button>
          </form>
        </section>
        <p aria-live="polite">6 of 6 resources</p>
      </main>`,
    );
  });

  it("the filtered empty state names itself and offers a way out", async () => {
    await expectNoViolations(
      "Resources",
      `<main>
        <h1>Resources</h1>
        <p aria-live="polite">0 of 6 resources</p>
        <section aria-labelledby="resources-empty-heading">
          <h2 id="resources-empty-heading">No resources match those filters</h2>
          <p>Clear a topic or widen the search to see more of the library.</p>
          <a href="/app/resources">Clear filters</a>
        </section>
      </main>`,
    );
  });

  it("event rows keep the date chip decorative and the time in text", async () => {
    await expectNoViolations(
      "Events",
      `<main>
        <header>
          <p>Training calendar</p>
          <h1>Events</h1>
        </header>
        <h2>Event list</h2>
        <ul>${EVENT_ROW}</ul>
      </main>`,
    );
  });

  it("the announcement emphasis card names its dismiss control", async () => {
    await expectNoViolations(
      "Home",
      `<main>
        <section aria-label="Announcements">
          <article>
            <span aria-hidden="true"></span>
            <p>Announcement</p>
            <h2>2026 credential renewals open through 12 September</h2>
            <p>Renewals take about ten minutes.</p>
            <form action="/app/announcements/example/cta/primary" method="post">
              <button type="submit">Start renewal</button>
            </form>
            <span>Posted 14 August 2026</span>
            <form action="/app/announcements/example/dismiss" method="post">
              <button aria-label="Dismiss announcement: 2026 credential renewals" type="submit">
                <span aria-hidden="true"></span>
              </button>
            </form>
          </article>
        </section>
        <h1>Home</h1>
      </main>`,
    );
  });

  it("directory list cards keep initials decorative and name the member link", async () => {
    await expectNoViolations(
      "Directory",
      `<main>
        <header>
          <p>Members</p>
          <h1>Directory</h1>
        </header>
        <section aria-labelledby="directory-search-heading">
          <h2 id="directory-search-heading">Search members</h2>
          <form action="/app/directory" method="get">
            <label for="directory-search">Search members</label>
            <input id="directory-search" maxlength="200" name="q" type="search" />
            <button type="submit">Search</button>
          </form>
        </section>
        <ul>
          <li>
            <article>
              <span aria-hidden="true">AS</span>
              <h2><a href="/app/directory/example">Ada Subject</a></h2>
              <p>Pathways to Change</p>
            </article>
          </li>
        </ul>
      </main>`,
    );
  });

  it("directory profile uses a heading for the name and labelled details", async () => {
    await expectNoViolations(
      "Ada Subject",
      `<main>
        <p><a href="/app/directory">Back to directory</a></p>
        <header>
          <span aria-hidden="true">AS</span>
          <h1>Ada Subject</h1>
          <p>Pathways to Change</p>
        </header>
        <dl>
          <div>
            <dt>Network</dt>
            <dd>Pathways to Change</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>shown@example.com</dd>
          </div>
        </dl>
      </main>`,
    );
  });

  it("directory privacy toggles stay labelled including uniform hide copy", async () => {
    await expectNoViolations(
      "Directory privacy",
      `<main>
        <header>
          <p>Account</p>
          <h1>Directory privacy</h1>
        </header>
        <form>
          <p>If you appear in the directory, members in your same program can see you. Super Admin, Admin, and Moderator can see listed members of both programs. Your name and network are always shown while you are listed. DOC affiliation, title, and email stay hidden unless you turn each one on. Hiding a field hides it from every directory viewer, including staff — not only peers.</p>
          <label><input name="listing" type="checkbox" value="true" />Appear in the member directory</label>
          <fieldset>
            <legend>Optional fields (hidden unless turned on)</legend>
            <label><input name="showTitle" type="checkbox" value="true" />Show title</label>
            <label><input name="showDocAffiliation" type="checkbox" value="true" />Show DOC affiliation</label>
            <label><input name="showEmail" type="checkbox" value="true" />Show email</label>
          </fieldset>
          <button type="submit">Save privacy settings</button>
        </form>
      </main>`,
    );
  });

  it("the guide index search is labelled and topics are headings inside links", async () => {
    await expectNoViolations(
      "Member guide",
      `<main>
        <header>
          <p>Help</p>
          <h1>Member guide</h1>
        </header>
        <section aria-labelledby="guide-search-heading">
          <h2 id="guide-search-heading">Search the guide</h2>
          <form action="/app/guide" method="get">
            <label for="guide-search">Search the guide</label>
            <input id="guide-search" maxlength="200" name="q" type="search" />
            <button type="submit">Search</button>
          </form>
        </section>
        <section aria-labelledby="guide-start-heading">
          <h2 id="guide-start-heading">Getting started</h2>
          <ul>
            <li>
              <a href="/app/guide/signing-in">
                <span>Sign in and request access</span>
                <span>How to get an account and sign in.</span>
              </a>
            </li>
          </ul>
        </section>
      </main>`,
    );
  });

  it("a guide article exposes a named contents list and skip target", async () => {
    await expectNoViolations(
      "Sign in and request access",
      `<main>
        <p><a href="/app/guide">All topics</a></p>
        <article>
          <header>
            <p>Member guide</p>
            <h1>Sign in and request access</h1>
          </header>
          <a href="#guide-article-body">Skip to article</a>
          <div id="guide-article-body">
            <h2 id="request-access">Request access</h2>
            <p>Use Request access from the public home page.</p>
          </div>
        </article>
        <nav aria-label="On this page">
          <p>On this page</p>
          <ol>
            <li><a href="#request-access">Request access</a></li>
          </ol>
        </nav>
      </main>`,
    );
  });

  it("active sessions name the revoke control per other device", async () => {
    await expectNoViolations(
      "Active sessions",
      `<main>
        <header>
          <p>Account</p>
          <h1>Active sessions</h1>
        </header>
        <ul>
          <li>
            <p>This device</p>
            <p>Mozilla/5.0</p>
          </li>
          <li>
            <p>Other device</p>
            <form>
              <button type="submit">Revoke</button>
            </form>
          </li>
        </ul>
      </main>`,
    );
  });
});
