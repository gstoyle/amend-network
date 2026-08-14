import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import {
  SESSION_COOKIE,
  asBrowserCloseSetCookie,
  sessionCookieName,
} from "@/lib/auth/session";

function cookieHeader(name: string, value: string, options: object): string {
  const parts = [`${name}=${value}`];
  for (const [key, raw] of Object.entries(options)) {
    if (raw === undefined || raw === false) {
      continue;
    }
    if (raw === true) {
      parts.push(key);
      continue;
    }
    parts.push(`${key}=${String(raw)}`);
  }
  return parts.join("; ");
}

describe("session cookie flags (FR-003)", () => {
  it("sets httpOnly, SameSite=Lax, and omits Max-Age/Expires on SESSION_COOKIE", () => {
    expect(SESSION_COOKIE.httpOnly).toBe(true);
    expect(SESSION_COOKIE.sameSite).toBe("lax");
    expect(SESSION_COOKIE.path).toBe("/");
    expect(SESSION_COOKIE).not.toHaveProperty("maxAge");
    expect(SESSION_COOKIE).not.toHaveProperty("expires");

    const header = cookieHeader("session", "opaque", SESSION_COOKIE);
    expect(header).not.toMatch(/Max-Age/i);
    expect(header).not.toMatch(/Expires=/i);
    expect(header).toMatch(/httpOnly/i);
    expect(header).toMatch(/sameSite=lax/i);
  });

  it("configures the Auth.js session cookie the same way with no Max-Age", () => {
    const options = authConfig.cookies?.sessionToken?.options;
    expect(options).toBeDefined();
    expect(options?.httpOnly).toBe(true);
    expect(options?.sameSite).toBe("lax");
    expect(options?.path).toBe("/");
    expect(options).not.toHaveProperty("maxAge");
    expect(options).not.toHaveProperty("expires");
  });

  it("strips Auth.js Expires and Max-Age from the session token Set-Cookie", () => {
    const name = sessionCookieName();
    const raw = `${name}=opaque; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Expires=Wed, 12 Sep 2026 00:00:00 GMT`;
    const stripped = asBrowserCloseSetCookie(raw);
    expect(stripped).not.toMatch(/Max-Age/i);
    expect(stripped).not.toMatch(/Expires=/i);
    expect(stripped).toMatch(/HttpOnly/i);
    expect(stripped).toMatch(/SameSite=Lax/i);
    expect(asBrowserCloseSetCookie("authjs.csrf-token=x; Max-Age=60")).toMatch(/Max-Age/i);
  });
});
