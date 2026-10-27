import axe from "axe-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { VisibilityFieldset } from "@/components/visibility-fieldset";

async function expectNoViolations(title: string, body: string): Promise<void> {
  document.documentElement.lang = "en";
  document.title = title;
  document.body.innerHTML = body;
  const results = await axe.run(document, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

describe("axe-core on cohort admin pages (014 T018)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("/admin/cohorts groups cohorts by programme with labelled forms", async () => {
    await expectNoViolations(
      "Cohorts",
      `<header><nav aria-label="Account"><button type="button">Log out</button></nav></header>
      <main>
        <h1>Cohorts</h1>
        <form>
          <label for="cohort-name">New cohort</label>
          <input id="cohort-name" maxlength="80" name="name" required type="text" />
          <label for="cohort-programme">Programme</label>
          <button aria-controls="cohort-programme-list" aria-expanded="false" aria-haspopup="listbox" id="cohort-programme" type="button"><span>Select a programme</span></button>
          <button type="submit">Add cohort</button>
        </form>
        <section aria-labelledby="cohorts-pathways">
          <h2 id="cohorts-pathways">Global Learning Experiences</h2>
          <ul>
            <li>
              <a href="/admin/cohorts/c1">Norway Sept 26</a>
              <span>1 member</span><span>Active</span>
              <form>
                <label for="cohort-name-c1">Cohort name</label>
                <input name="id" type="hidden" value="c1" />
                <input id="cohort-name-c1" maxlength="80" name="name" required type="text" value="Norway Sept 26" />
                <button type="submit">Save name</button>
                <p aria-live="polite" role="alert">That name is already in use.</p>
              </form>
              <form>
                <input name="id" type="hidden" value="c1" />
                <button type="submit">Archive</button>
              </form>
            </li>
          </ul>
        </section>
        <section aria-labelledby="cohorts-lead">
          <h2 id="cohorts-lead">LEAD</h2>
          <p>No cohorts yet.</p>
        </section>
      </main>`,
    );
  });

  it("resource, event, and announcement forms share a grouped visibility fieldset (T034)", async () => {
    const archivedId = "00000000-0000-4000-8000-000000000003";
    const markup = renderToStaticMarkup(
      createElement(VisibilityFieldset, {
        cohorts: [
          { id: "00000000-0000-4000-8000-000000000001", name: "Norway Sept 26", programRole: "pathways", archived: false },
          { id: "00000000-0000-4000-8000-000000000002", name: "Norway April 27", programRole: "pathways", archived: false },
          { id: archivedId, name: "Norway Spring 25", programRole: "pathways", archived: true },
          { id: "00000000-0000-4000-8000-000000000004", name: "Old trip", programRole: "pathways", archived: true },
        ],
        selected: [`cohort:${archivedId}`],
      }),
    );
    await expectNoViolations("New resource", `<main><h1>New resource</h1><form>${markup}</form></main>`);
    expect(document.querySelectorAll("fieldset legend")).toHaveLength(3);
    expect(document.body.textContent).toContain("Norway Spring 25 (archived)");
    expect(document.body.textContent).not.toContain("Old trip");
  });

  it("/admin/cohorts/[id] lists members with named remove buttons", async () => {
    await expectNoViolations(
      "Norway Sept 26",
      `<header><nav aria-label="Account"><button type="button">Log out</button></nav></header>
      <main>
        <a href="/admin/cohorts">All cohorts</a>
        <h1>Norway Sept 26</h1>
        <form>
          <input name="cohortId" type="hidden" value="c1" />
          <label for="member-email">Member email</label>
          <input autocomplete="off" id="member-email" name="email" required type="email" />
          <p aria-live="polite" role="alert">No eligible member with that email.</p>
          <button type="submit">Add member</button>
        </form>
        <section aria-labelledby="cohort-members-heading">
          <h2 id="cohort-members-heading">Members</h2>
          <ul>
            <li><span>Ada Lovelace</span><span>Primary cohort</span></li>
            <li>
              <span>Grace Hopper</span>
              <form>
                <button aria-label="Remove Grace Hopper" type="submit">Remove</button>
              </form>
            </li>
          </ul>
        </section>
      </main>`,
    );
  });
});
