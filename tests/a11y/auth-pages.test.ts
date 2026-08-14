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

describe("axe-core on auth pages (T067)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("login", async () => {
    await expectNoViolations(
      "Sign in",
      `<main><h1>Sign in</h1><form><label for="email">Email</label><input id="email" name="email" type="email" /><label for="password">Password</label><input id="password" name="password" type="password" /><button type="submit">Sign in</button></form></main>`,
    );
  });

  it("pending", async () => {
    await expectNoViolations(
      "Request under review",
      `<main><h1>Request under review</h1><p>Your registration is pending review.</p></main>`,
    );
  });

  it("sessions", async () => {
    await expectNoViolations(
      "Active sessions",
      `<main><h1>Active sessions</h1><ul><li><p>this device</p><form><button type="submit">Revoke</button></form></li></ul></main>`,
    );
  });

  it("mfa", async () => {
    await expectNoViolations(
      "Authenticator code",
      `<main><h1>Authenticator code</h1><form><label for="code">Authenticator code</label><input id="code" name="code" inputmode="numeric" /><button type="submit">Continue</button></form></main>`,
    );
  });

  it("admin", async () => {
    await expectNoViolations(
      "Admin",
      `<main><h1>Admin</h1><p>You are signed in with an administrative session.</p></main>`,
    );
  });
});
