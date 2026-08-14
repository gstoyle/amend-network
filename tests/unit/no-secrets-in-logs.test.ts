import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendResetEmail } from "@/lib/email/transport";
import { env } from "@/lib/env";

const SECRET_PATTERNS = [
  /passwordHash/i,
  /mfaSecret/i,
  /SEED_PASSWORD/,
  /PII_ENCRYPTION_KEY/,
  /AUTH_SECRET/,
];

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTs(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("logs never contain secrets (T068)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not console.log reset tokens when sending mail", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const token = "reset-token-must-not-appear-in-logs";
    await sendResetEmail({
      to: "pathways@local",
      resetUrl: `http://127.0.0.1:3000/reset-password?token=${token}`,
    });
    const printed = [...log.mock.calls, ...error.mock.calls].flat().join(" ");
    expect(printed).not.toContain(token);
  });

  it("source under lib/ does not log secret env names or hashes", () => {
    const root = join(process.cwd(), "lib");
    for (const file of walkTs(root)) {
      const source = readFileSync(file, "utf8");
      for (const pattern of SECRET_PATTERNS) {
        if (!source.includes("console.")) {
          continue;
        }
        const consoleLines = source.split("\n").filter((line) => line.includes("console."));
        for (const line of consoleLines) {
          expect(line).not.toMatch(pattern);
        }
      }
    }
    expect(env().EMAIL_TRANSPORT).toBe("json");
  });
});
