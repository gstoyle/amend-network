import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const VERSION = 0x01;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function parseHexKey(hex: string): Buffer {
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error("PII key must be 32 bytes");
  }
  return key;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function dbBytes(value: Buffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

export function hmacEmailLookup(email: string): Uint8Array<ArrayBuffer> {
  const key = parseHexKey(env().EMAIL_LOOKUP_KEY);
  return dbBytes(createHmac("sha256", key).update(normalizeEmail(email)).digest());
}

export function encryptPii(plaintext: string): Uint8Array<ArrayBuffer> {
  const key = parseHexKey(env().PII_ENCRYPTION_KEY);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return dbBytes(Buffer.concat([Buffer.from([VERSION]), iv, ciphertext, tag]));
}

export function decryptPii(payload: Uint8Array): string {
  const key = parseHexKey(env().PII_ENCRYPTION_KEY);
  const buf = Buffer.from(payload);
  if (buf.length < 1 + IV_LENGTH + TAG_LENGTH) {
    throw new Error("ciphertext too short");
  }
  const version = buf[0];
  if (version !== VERSION) {
    throw new Error("unsupported ciphertext version");
  }
  const iv = buf.subarray(1, 1 + IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const ciphertext = buf.subarray(1 + IV_LENGTH, buf.length - TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
