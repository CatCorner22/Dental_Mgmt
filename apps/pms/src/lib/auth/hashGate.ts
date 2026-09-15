const DEFAULT_MAX = 4;

const parsed = Math.trunc(Number(process.env.MAX_CONCURRENT_HASHES));
export const MAX_CONCURRENT_HASHES = parsed > 0 ? parsed : DEFAULT_MAX;

let inFlight = 0;

export function hashesInFlight(): number {
  return inFlight;
}

export type SlotResult<T> = { ok: true; value: T } | { ok: false };

export async function withHashSlot<T>(fn: () => Promise<T>): Promise<SlotResult<T>> {
  if (inFlight >= MAX_CONCURRENT_HASHES) return { ok: false };
  inFlight++;
  try {
    return { ok: true, value: await fn() };
  } finally {
    inFlight--;
  }
}

export function resetHashGate(): void {
  inFlight = 0;
}
