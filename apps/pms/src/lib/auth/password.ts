import bcrypt from "bcryptjs";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

function bcryptCost(): number {
  const parsed = Number(process.env.BCRYPT_COST);
  return parsed > 0 ? parsed : 12;
}

export function passwordPolicyError(plain: string): string | null {
  if (plain.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (Buffer.byteLength(plain, "utf8") > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} bytes.`;
  }
  if (/^(.)\1+$/.test(plain)) {
    return "Password is too simple — it is a single repeated character.";
  }
  return null;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, bcryptCost());
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Never-matching hashes so unknown-username logins burn the same bcrypt time. */
const DUMMY_COST4 = "$2b$04$GFMdXfcPgZd0Z6OdRVYiQ.DeixpqbW30/jnBg353tJ8y9wckm9xW6";
const DUMMY_COST12 = "$2b$12$trtV1CTHstBOdm7lfhVlbOLvcgExqOjspQH8/XiGsdsKahewnGzfS";

export function timingDummyHash(): string {
  return bcryptCost() <= 4 ? DUMMY_COST4 : DUMMY_COST12;
}
