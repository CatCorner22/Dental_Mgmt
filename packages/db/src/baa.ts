/**
 * BAA gate for the integration registry.
 * enabled requires a live (signed, unexpired) BAA row. Application-enforced
 * here; a trigger in the migration refuses a violating UPDATE/INSERT.
 */
export interface BaaRecord {
  signedAt: Date | null;
  expiresAt: Date | null;
  documentRef: string | null;
}

export function baaIsLive(baa: BaaRecord, now: Date = new Date()): boolean {
  if (!baa.signedAt) return false;
  if (baa.signedAt.getTime() > now.getTime()) return false;
  if (baa.expiresAt && baa.expiresAt.getTime() <= now.getTime()) return false;
  if (!baa.documentRef || !baa.documentRef.trim()) return false;
  return true;
}

export function canEnableIntegration(baa: BaaRecord, now: Date = new Date()): boolean {
  return baaIsLive(baa, now);
}

export function refuseEnabledWithoutBaa(
  enabled: boolean,
  baa: BaaRecord,
  now: Date = new Date()
): { ok: true } | { ok: false; code: "baa_required" } {
  if (!enabled) return { ok: true };
  return canEnableIntegration(baa, now) ? { ok: true } : { ok: false, code: "baa_required" };
}
