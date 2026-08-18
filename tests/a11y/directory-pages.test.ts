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

const MEMBER_CHROME = `<header>
  <nav aria-label="Member">
    <a href="/app">Home</a>
    <a href="/app/resources">Resources</a>
    <a href="/app/events">Events</a>
    <a href="/app/directory">Directory</a>
    <a href="/app/profile/privacy">Privacy</a>
  </nav>
  <nav aria-label="Account"><button type="button">Log out</button></nav>
</header>`;

const PRIVACY_PROMPT = `<aside aria-label="Directory privacy">
  <p>You are not in the member directory until you choose. If you opt in, same-program members and staff who can view the directory will see your name and network. DOC affiliation, title, and email stay hidden unless you turn them on. Those hides apply to every viewer, including staff.</p>
  <p><a href="/app/profile/privacy">Set directory privacy</a></p>
</aside>`;

describe("axe-core on directory pages (T035)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("/app home first-run directory prompt is a labeled aside with a named control", async () => {
    await expectNoViolations(
      "Home",
      `${MEMBER_CHROME}
      <main>
        <h1>Home</h1>
        ${PRIVACY_PROMPT}
        <p>You are signed in.</p>
      </main>`,
    );
  });

  it("/app/directory search is labeled and the try-later error is announced", async () => {
    await expectNoViolations(
      "Directory",
      `${MEMBER_CHROME}
      <main>
        <h1>Directory</h1>
        ${PRIVACY_PROMPT}
        <form action="/app/directory" method="get">
          <label for="directory-search">Search members</label>
          <input id="directory-search" maxlength="200" name="q" type="search" />
          <p role="alert">Try again later.</p>
          <button type="submit">Search</button>
        </form>
        <p>No members match.</p>
      </main>`,
    );
  });

  it("/app/directory results list names each member link", async () => {
    await expectNoViolations(
      "Directory",
      `${MEMBER_CHROME}
      <main>
        <h1>Directory</h1>
        <form action="/app/directory" method="get">
          <label for="directory-search">Search members</label>
          <input id="directory-search" name="q" type="search" />
          <button type="submit">Search</button>
        </form>
        <ul>
          <li>
            <p>
              <span aria-hidden="true">AS</span>
              <a href="/app/directory/example">Ada Subject</a>
            </p>
            <p>Pathways to Change</p>
          </li>
        </ul>
      </main>`,
    );
  });

  it("/app/directory/[id] uses initials as decorative and a heading for the name", async () => {
    await expectNoViolations(
      "Ada Subject",
      `${MEMBER_CHROME}
      <main>
        <p><a href="/app/directory">Back to directory</a></p>
        <span aria-hidden="true">AS</span>
        <h1>Ada Subject</h1>
        <p>Pathways to Change</p>
        <p>shown@example.com</p>
      </main>`,
    );
  });

  it("/app/profile/privacy toggles are labeled including uniform hide copy", async () => {
    await expectNoViolations(
      "Directory privacy",
      `${MEMBER_CHROME}
      <main>
        <h1>Directory privacy</h1>
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
});
