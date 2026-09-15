import { Secret, TOTP } from "otpauth";

const PERIOD = 30;
const DIGITS = 6;
const ISSUER = "Practice PMS";

export function generateMfaSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totpFor(username: string, secretBase32: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function mfaEnrollmentUri(username: string, secretBase32: string): string {
  return totpFor(username, secretBase32).toString();
}

export function verifyMfaCode(
  username: string,
  secretBase32: string,
  code: string,
  now: number = Date.now()
): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    const delta = totpFor(username, secretBase32).validate({
      token: cleaned,
      timestamp: now,
      window: 1,
    });
    return delta !== null;
  } catch {
    return false;
  }
}

export function currentCodeForTest(
  username: string,
  secretBase32: string,
  now: number
): string {
  return totpFor(username, secretBase32).generate({ timestamp: now });
}
