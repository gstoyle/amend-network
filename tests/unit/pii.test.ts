import { describe, expect, it } from "vitest";
import {
  decryptPii,
  encryptPii,
  hmacEmailLookup,
  normalizeEmail,
} from "@/lib/crypto/pii";

describe("PII helpers (FR-022)", () => {
  it("round-trips plaintext through AES-256-GCM", () => {
    const plain = "member@example.com";
    const encrypted = encryptPii(plain);
    expect(encrypted).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(encrypted).equals(Buffer.from(plain, "utf8"))).toBe(false);
    expect(decryptPii(encrypted)).toBe(plain);
  });

  it("uses a distinct IV so the same plaintext encrypts differently", () => {
    const a = encryptPii("same");
    const b = encryptPii("same");
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(decryptPii(a)).toBe("same");
    expect(decryptPii(b)).toBe("same");
  });

  it("HMAC email lookup is deterministic after normalize", () => {
    const left = hmacEmailLookup("  PathWays@Local ");
    const right = hmacEmailLookup("pathways@local");
    expect(Buffer.from(left).equals(Buffer.from(right))).toBe(true);
    expect(normalizeEmail("  PathWays@Local ")).toBe("pathways@local");
  });
});
