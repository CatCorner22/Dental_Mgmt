import {
  FREE_ATTEMPTS,
  IP_MAX_LOCK_MS,
  MAX_LOCK_MS,
  UNLOCKED,
  WINDOW_MS,
  lockMsFor,
  type ThrottleState,
} from "./throttle";
import type { AuthStore, ThrottleRow } from "./store";

export async function checkThrottle(
  store: AuthStore,
  key: string,
  now: Date
): Promise<ThrottleState> {
  const row = await store.getThrottle(key);
  if (!row?.lockedUntil) return UNLOCKED;
  const remainingMs = row.lockedUntil.getTime() - now.getTime();
  if (remainingMs <= 0) return UNLOCKED;
  return { locked: true, retryAfterSec: Math.ceil(remainingMs / 1000), justLocked: false };
}

export async function recordFailure(
  store: AuthStore,
  key: string,
  now: Date,
  freeAttempts: number = FREE_ATTEMPTS,
  maxLockMs: number = MAX_LOCK_MS
): Promise<ThrottleState> {
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  await store.pruneThrottle(now);

  const existing = await store.getThrottle(key);
  let next: ThrottleRow;
  if (!existing) {
    next = {
      key,
      tenantId: null,
      failCount: 1,
      firstFailAt: now,
      lockedUntil: null,
    };
  } else if (existing.lockedUntil && existing.lockedUntil.getTime() > now.getTime()) {
    next = existing;
  } else if (existing.lockedUntil && existing.lockedUntil.getTime() <= now.getTime()) {
    next = { key, tenantId: existing.tenantId, failCount: 1, firstFailAt: now, lockedUntil: null };
  } else if (existing.firstFailAt.getTime() < windowStart.getTime()) {
    next = { key, tenantId: existing.tenantId, failCount: 1, firstFailAt: now, lockedUntil: null };
  } else {
    next = {
      ...existing,
      failCount: existing.failCount + 1,
    };
  }

  const stored = await store.putThrottle(next);
  const remainingMs = stored.lockedUntil ? stored.lockedUntil.getTime() - now.getTime() : 0;
  if (remainingMs > 0) {
    return { locked: true, retryAfterSec: Math.ceil(remainingMs / 1000), justLocked: false };
  }

  const lockMs = lockMsFor(stored.failCount, freeAttempts, maxLockMs);
  if (lockMs <= 0) return UNLOCKED;
  const lockedUntil = new Date(now.getTime() + lockMs);
  const applied = await store.applyLock(key, lockedUntil, now);
  if (!applied) {
    const existingLock = await checkThrottle(store, key, now);
    return existingLock.locked ? existingLock : UNLOCKED;
  }
  return { locked: true, retryAfterSec: Math.ceil(lockMs / 1000), justLocked: true };
}

export async function clearThrottle(store: AuthStore, key: string): Promise<void> {
  await store.deleteThrottle(key);
}

export { FREE_ATTEMPTS, IP_MAX_LOCK_MS, MAX_LOCK_MS };
