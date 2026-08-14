import * as OTPAuth from "otpauth";

const ISSUER = "Amend";
const ALGORITHM = "SHA1";
const DIGITS = 6;
const PERIOD = 30;

export type TotpHandle = {
  secret: string;
  otpauthUri: string;
  generate: () => string;
};

function totpFor(label: string, secret?: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: secret ?? new OTPAuth.Secret({ size: 20 }),
  });
}

export function generateTotp(input: { label: string; secret?: string }): TotpHandle {
  const totp = totpFor(input.label, input.secret);
  return {
    secret: totp.secret.base32,
    otpauthUri: totp.toString(),
    generate: () => totp.generate(),
  };
}

export function verifyTotp(secret: string, token: string): boolean {
  return totpFor("verify", secret).validate({ token, window: 1 }) !== null;
}
