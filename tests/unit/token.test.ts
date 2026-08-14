import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashToken, randomToken } from "@/lib/crypto/token";

describe("invite/reset token helpers", () => {
  it("hashes with SHA-256 and is deterministic", () => {
    const token = "a".repeat(64);
    const hashed = hashToken(token);
    expect(hashed).toBeInstanceOf(Uint8Array);
    expect(hashed.byteLength).toBe(32);
    expect(Buffer.from(hashed).equals(createHash("sha256").update(token).digest())).toBe(true);
    expect(Buffer.from(hashToken(token)).equals(Buffer.from(hashed))).toBe(true);
  });

  it("randomToken is 32 bytes of entropy encoded as 64 hex chars", () => {
    const token = randomToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const other = randomToken();
    expect(other).not.toBe(token);
    expect(hashToken(token).byteLength).toBe(32);
  });
});
