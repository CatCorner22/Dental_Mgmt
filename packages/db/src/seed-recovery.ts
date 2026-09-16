import { createHash } from "node:crypto";

/** Mirrors apps/pms/src/lib/auth/recovery.ts for seeding only. */
export function hashRecoveryCode(code: string, pepper: string): string {
  const normalized = code.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return createHash("sha256").update(`${pepper}\n${normalized}`).digest("hex");
}

export function hashRecoveryCodes(codes: string[], pepper: string): string[] {
  return codes.map((code) => hashRecoveryCode(code, pepper));
}
