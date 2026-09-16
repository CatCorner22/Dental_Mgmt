export const FREE_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_LOCK_MS = 15 * 60 * 1000;
export const IP_FREE_ATTEMPTS = 30;
export const IP_MAX_LOCK_MS = 60 * 1000;

export function lockMsFor(
  failCount: number,
  freeAttempts: number = FREE_ATTEMPTS,
  maxLockMs: number = MAX_LOCK_MS
): number {
  const over = failCount - freeAttempts;
  if (over <= 0) return 0;
  return Math.min(maxLockMs, 1000 * 2 ** (over - 1) * 15);
}

const MAX_KEY_CHARS = 80;

export function loginPairKey(ip: string, username: string): string {
  return `login:${ip.slice(0, MAX_KEY_CHARS)}|${username.toLowerCase().slice(0, MAX_KEY_CHARS)}`;
}

export function loginIpKey(ip: string): string {
  return `loginip:${ip.slice(0, MAX_KEY_CHARS)}`;
}

export interface ThrottleState {
  locked: boolean;
  retryAfterSec: number;
  justLocked: boolean;
}

export const UNLOCKED: ThrottleState = { locked: false, retryAfterSec: 0, justLocked: false };
