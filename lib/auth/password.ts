import { hash, verify } from "@node-rs/argon2";

const MIN_LENGTH = 12;

const ARGON2ID_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_LENGTH) {
    throw new Error("password does not meet length requirement");
  }
  return hash(plain, ARGON2ID_OPTIONS);
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  return verify(hashValue, plain);
}
