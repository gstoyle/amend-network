import { createHash, randomBytes } from "node:crypto";

export function hashToken(token: string): Uint8Array<ArrayBuffer> {
  const digest = createHash("sha256").update(token).digest();
  const copy = new Uint8Array(digest.byteLength);
  copy.set(digest);
  return copy;
}

export function randomToken(): string {
  return randomBytes(32).toString("hex");
}
