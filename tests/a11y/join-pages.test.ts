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

describe("axe-core on join pages (T045)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("/register uses labeled fields and a DOC select (no free text)", async () => {
    await expectNoViolations(
      "Request access",
      `<main>
        <h1>Request access</h1>
        <form>
          <label for="firstName">First name</label><input id="firstName" name="firstName" type="text" />
          <label for="lastName">Last name</label><input id="lastName" name="lastName" type="text" />
          <label for="docAffiliation">DOC affiliation</label>
          <select id="docAffiliation" name="docAffiliation"><option value="">Select an affiliation</option></select>
          <label for="title">Title / role</label><input id="title" name="title" type="text" />
          <label for="email">Email</label><input id="email" name="email" type="email" />
          <label for="networkId">Network</label>
          <select id="networkId" name="networkId"><option value="">Select a network</option></select>
          <label for="password">Password</label><input id="password" name="password" type="password" />
          <button type="submit">Request access</button>
        </form>
      </main>`,
    );
  });

  it("/invite/[token] pre-fills locked email and labeled remaining fields", async () => {
    await expectNoViolations(
      "Complete invitation",
      `<main>
        <h1>Complete invitation</h1>
        <form>
          <input name="token" type="hidden" value="placeholder" />
          <label for="email">Email</label><input id="email" name="email" readonly type="email" value="ada@example.com" />
          <label for="firstName">First name</label><input id="firstName" name="firstName" readonly type="text" value="Ada" />
          <label for="lastName">Last name</label><input id="lastName" name="lastName" readonly type="text" value="Lovelace" />
          <label for="networkName">Network</label><input id="networkName" name="networkName" readonly type="text" value="LEAD" />
          <label for="title">Title / role</label><input id="title" name="title" type="text" />
          <label for="docAffiliation">DOC affiliation</label>
          <select id="docAffiliation" name="docAffiliation"><option value="">Select an affiliation</option></select>
          <label for="password">Password</label><input id="password" name="password" type="password" />
          <button type="submit">Complete registration</button>
        </form>
      </main>`,
    );
  });

  it("/admin/users/pending", async () => {
    await expectNoViolations(
      "Pending registrations",
      `<header><nav aria-label="Account"><button type="button">Log out</button></nav></header>
      <main>
        <h1>Pending registrations</h1>
        <form method="get">
          <label for="networkId">Filter by network</label>
          <select id="networkId" name="networkId"><option value="">All networks</option></select>
          <button type="submit">Apply filter</button>
        </form>
        <ul>
          <li>
            <p>Ada Lovelace</p>
            <form>
              <label for="network-1">Assign network</label>
              <select id="network-1" name="networkId"><option value="n1">Pathways to Change</option></select>
              <button type="submit">Approve</button>
            </form>
            <form>
              <label for="reason-1">Denial reason (admin only)</label>
              <input id="reason-1" name="reason" type="text" />
              <button type="submit">Deny</button>
            </form>
          </li>
        </ul>
      </main>`,
    );
  });

  it("/admin/users/invite", async () => {
    await expectNoViolations(
      "Invitations",
      `<header><nav aria-label="Account"><button type="button">Log out</button></nav></header>
      <main>
        <h1>Invitations</h1>
        <form>
          <h2>Manual invitation</h2>
          <label for="email">Email</label><input id="email" name="email" type="email" />
          <label for="firstName">First name</label><input id="firstName" name="firstName" type="text" />
          <label for="lastName">Last name</label><input id="lastName" name="lastName" type="text" />
          <label for="networkId">Network</label>
          <select id="networkId" name="networkId"><option value="">Select a network</option></select>
          <label for="title">Title / role (optional)</label><input id="title" name="title" type="text" />
          <button type="submit">Send invitation</button>
        </form>
        <form>
          <h2>CSV invitations</h2>
          <label for="csvFile">CSV file</label><input id="csvFile" name="csvFile" type="file" />
          <label for="csvText">Or paste CSV</label><textarea id="csvText" name="csvText"></textarea>
          <button type="submit">Send CSV invitations</button>
        </form>
      </main>`,
    );
  });

  it("/admin/users/affiliations", async () => {
    await expectNoViolations(
      "DOC affiliations",
      `<header><nav aria-label="Account"><button type="button">Log out</button></nav></header>
      <main>
        <h1>DOC affiliations</h1>
        <form>
          <label for="label">New affiliation</label>
          <input id="label" name="label" type="text" />
          <button type="submit">Add</button>
        </form>
      </main>`,
    );
  });
});
