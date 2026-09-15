import bcrypt from "bcryptjs";

const COST = 12;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

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
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
