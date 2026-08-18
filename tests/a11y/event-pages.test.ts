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
  </nav>
  <nav aria-label="Account"><button type="button">Log out</button></nav>
</header>`;

describe("axe-core on event pages (T045 / FR-029)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("/app home upcoming events list is labeled", async () => {
    await expectNoViolations(
      "Home",
      `${MEMBER_CHROME}
      <main>
        <h1>Home</h1>
        <section aria-label="Upcoming events">
          <h2>Upcoming events</h2>
          <p><a href="/app/events">All events</a></p>
          <ul>
            <li>
              <a href="/app/events/example">Shared workshop</a>
              <p><time datetime="2026-08-18T18:00:00.000Z">Aug 18, 2026, 2:00 PM</time></p>
            </li>
          </ul>
        </section>
      </main>`,
    );
  });

  it("/app/events month view has a named month/list toggle and month table", async () => {
    await expectNoViolations(
      "Events",
      `${MEMBER_CHROME}
      <main>
        <h1>Events</h1>
        <p><a href="/app">Home</a></p>
        <div role="group" aria-label="Calendar view">
          <a aria-current="page" href="/app/events?view=month&amp;month=2026-08">Month</a>
          <a href="/app/events?view=list&amp;month=2026-08">List</a>
        </div>
        <div>
          <a href="/app/events?view=month&amp;month=2026-07">Previous month</a>
          <p>August 2026</p>
          <a href="/app/events?view=month&amp;month=2026-09">Next month</a>
        </div>
        <table>
          <caption>August 2026</caption>
          <thead>
            <tr>
              <th scope="col">Sunday</th>
              <th scope="col">Monday</th>
              <th scope="col">Tuesday</th>
              <th scope="col">Wednesday</th>
              <th scope="col">Thursday</th>
              <th scope="col">Friday</th>
              <th scope="col">Saturday</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td>
                <p>1</p>
                <ul>
                  <li><a href="/app/events/example">Shared workshop</a></li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </main>`,
    );
  });

  it("/app/events list view names each event link", async () => {
    await expectNoViolations(
      "Events",
      `${MEMBER_CHROME}
      <main>
        <h1>Events</h1>
        <div role="group" aria-label="Calendar view">
          <a href="/app/events?view=month&amp;month=2026-08">Month</a>
          <a aria-current="page" href="/app/events?view=list&amp;month=2026-08">List</a>
        </div>
        <ul>
          <li>
            <a href="/app/events/example">Shared workshop</a>
            <p><time datetime="2026-08-18T18:00:00.000Z">Aug 18, 2026, 2:00 PM</time></p>
          </li>
        </ul>
      </main>`,
    );
  });

  it("/app/events/[id] RSVP controls and calendar download are named", async () => {
    await expectNoViolations(
      "Shared workshop",
      `${MEMBER_CHROME}
      <main>
        <p><a href="/app/events">Back to events</a></p>
        <h1>Shared workshop</h1>
        <p><time datetime="2026-08-18T18:00:00.000Z">Aug 18, 2026, 2:00 PM</time></p>
        <p>100 Main Street</p>
        <p><a href="/app/events/example/ics">Download calendar file</a></p>
        <form action="/app/events/example/rsvp" method="post">
          <fieldset>
            <legend>Your RSVP</legend>
            <button name="status" type="submit" value="yes">Yes</button>
            <button name="status" type="submit" value="no">No</button>
            <button name="status" type="submit" value="maybe">Maybe</button>
          </fieldset>
        </form>
      </main>`,
    );
  });

  it("/admin/events lists cancelled state and edit links", async () => {
    await expectNoViolations(
      "Events",
      `<main>
        <h1>Events</h1>
        <p><a href="/admin/events/new">New event</a></p>
        <ul>
          <li>
            <p><a href="/admin/events/example">Live workshop</a></p>
            <p>scheduled · all_authenticated</p>
          </li>
          <li>
            <p><a href="/admin/events/cancelled">Cancelled workshop</a></p>
            <p>cancelled · all_authenticated</p>
          </li>
        </ul>
      </main>`,
    );
  });

  it("/admin/events/new uses labeled publish fields", async () => {
    await expectNoViolations(
      "New event",
      `<main>
        <h1>New event</h1>
        <form>
          <label for="title">Title</label>
          <input id="title" name="title" type="text" />
          <label for="description">Description</label>
          <textarea id="description" name="description"></textarea>
          <fieldset>
            <legend>Visibility</legend>
            <label><input name="visibility" type="checkbox" value="all_authenticated" />Everyone signed in</label>
          </fieldset>
          <label for="startsAt">Starts</label>
          <input id="startsAt" name="startsAt" type="datetime-local" />
          <label for="endsAt">Ends</label>
          <input id="endsAt" name="endsAt" type="datetime-local" />
          <label for="location">Location</label>
          <input id="location" name="location" type="text" />
          <label><input name="isVirtual" type="checkbox" value="true" />Virtual meeting</label>
          <label for="joinUrl">Join URL</label>
          <input id="joinUrl" name="joinUrl" type="text" />
          <label for="capacity">Capacity (optional)</label>
          <input id="capacity" min="1" name="capacity" type="number" />
          <button type="submit">Publish</button>
        </form>
      </main>`,
    );
  });

  it("/admin/events/[id] edit, notify, and cancel are labeled", async () => {
    await expectNoViolations(
      "Edit event",
      `<main>
        <h1>Edit event</h1>
        <form>
          <label for="title">Title</label>
          <input id="title" name="title" type="text" />
          <label for="description">Description</label>
          <textarea id="description" name="description"></textarea>
          <label for="startsAt">Starts</label>
          <input id="startsAt" name="startsAt" type="datetime-local" />
          <label for="endsAt">Ends</label>
          <input id="endsAt" name="endsAt" type="datetime-local" />
          <label>
            <input name="confirmCapacityShrink" type="checkbox" value="true" />
            Save even if capacity is below the current Yes count. Existing Yes RSVPs stay Yes.
          </label>
          <label>
            <input name="notifyRsvps" type="checkbox" value="true" />
            Email people who RSVPed if the start or end time changes
          </label>
          <label for="notifyMessage">Optional message</label>
          <textarea id="notifyMessage" name="notifyMessage"></textarea>
          <button type="submit">Save</button>
        </form>
        <form>
          <button type="submit">Cancel event</button>
        </form>
      </main>`,
    );
  });
});
