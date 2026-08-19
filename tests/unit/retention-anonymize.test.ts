import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { buildAnonymizedUserPatch, retentionSentinelEmail } from "@/lib/retention/anonymize";

const SOURCE = readFileSync(join(process.cwd(), "lib/retention/anonymize.ts"), "utf8");

describe("retention anonymize uses PII helpers (US2 / FR-014)", () => {
  it("builds ciphertext and sentinel lookup through encryptPii and hmacEmailLookup", async () => {
    const userId = randomUUID();
    const originalEmail = "keep.me@example.com";
    const originalName = "Ada";
    const patch = await buildAnonymizedUserPatch(userId);
    const sentinel = retentionSentinelEmail(userId);

    expect(decryptPii(patch.emailEncrypted)).toBe(sentinel);
    expect(decryptPii(patch.emailEncrypted)).not.toBe(originalEmail);
    expect(decryptPii(patch.firstNameEncrypted)).toBe("");
    expect(decryptPii(patch.firstNameEncrypted)).not.toBe(originalName);
    expect(decryptPii(patch.lastNameEncrypted)).toBe("");
    expect(decryptPii(patch.titleEncrypted)).toBe("");
    expect(decryptPii(patch.docAffiliationIdEncrypted)).toBe("");
    expect(decryptPii(patch.denialReasonEncrypted)).toBe("");
    expect(Buffer.from(patch.emailLookup).equals(Buffer.from(hmacEmailLookup(originalEmail)))).toBe(
      false,
    );
    expect(Buffer.from(patch.emailLookup).equals(Buffer.from(hmacEmailLookup(sentinel)))).toBe(true);
    expect(patch.mfaSecretEncrypted).toBeNull();
    expect(patch.mfaEnabled).toBe(false);
    expect(patch.registrationIp).toBeNull();
    expect(patch.directoryVisible).toBe(false);
  });

  it("does not write original PII with raw SQL", () => {
    expect(SOURCE).toMatch(/encryptPii\(/);
    expect(SOURCE).toMatch(/hmacEmailLookup\(/);
    expect(SOURCE).toMatch(/hashPassword\(/);
    expect(SOURCE).not.toMatch(/\$executeRaw/);
    expect(SOURCE).not.toMatch(/\$queryRaw/);
    expect(SOURCE).not.toMatch(/emailEncrypted:\s*original/i);
  });
});
