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

/**
 * The 30 s step the code belongs to, or null when it matches no step in the
 * ±1 window. A verifier records the accepted step so the same code cannot
 * open a second session (RFC 6238 §5.2).
 */
export function matchMfaCodeStep(
  username: string,
  secretBase32: string,
  code: string,
  now: number = Date.now()
): number | null {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return null;
  try {
    const delta = totpFor(username, secretBase32).validate({
      token: cleaned,
      timestamp: now,
      window: 1,
    });
    if (delta === null) return null;
    return Math.floor(now / (PERIOD * 1000)) + delta;
  } catch {
    return null;
  }
}

export function verifyMfaCode(
  username: string,
  secretBase32: string,
  code: string,
  now: number = Date.now()
): boolean {
  return matchMfaCodeStep(username, secretBase32, code, now) !== null;
}

export function currentCodeForTest(
  username: string,
  secretBase32: string,
  now: number
): string {
  return totpFor(username, secretBase32).generate({ timestamp: now });
}
