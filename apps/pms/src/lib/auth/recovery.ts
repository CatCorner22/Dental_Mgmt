import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const RECOVERY_CODE_COUNT = 10;

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(4).toString("hex");
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string, pepper: string): string {
  const normalized = normalizeRecoveryCode(code);
  return createHash("sha256").update(`${pepper}\n${normalized}`).digest("hex");
}

export function hashRecoveryCodes(codes: string[], pepper: string): string[] {
  return codes.map((code) => hashRecoveryCode(code, pepper));
}

/**
 * Returns the index of a matching unused hash, or -1.
 * Comparison is constant-time against every remaining hash.
 */
export function indexOfRecoveryCode(
  code: string,
  hashes: string[],
  pepper: string
): number {
  const target = Buffer.from(hashRecoveryCode(code, pepper), "hex");
  let found = -1;
  for (let i = 0; i < hashes.length; i++) {
    const candidate = Buffer.from(hashes[i] ?? "", "hex");
    if (candidate.length !== target.length) continue;
    if (timingSafeEqual(candidate, target) && found === -1) found = i;
  }
  return found;
}

export function parseRecoveryHashes(stored: string | null | undefined): string[] {
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function serializeRecoveryHashes(hashes: string[]): string {
  return JSON.stringify(hashes);
}
