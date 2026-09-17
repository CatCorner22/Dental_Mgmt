import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeCredentials } from "./auth/authorize";
import { DEV_MFA_SECRET, DEV_PASSWORD } from "./auth/devSeed";
import { createMemoryStore } from "./auth/memoryStore";
import { loginPairKey } from "./auth/throttle";
import { currentCodeForTest } from "./auth/totp";

/**
 * Swarm 2, lens pms-app-authz. Each test asserts the correct behaviour and
 * fails on the reference commit; the failure output is the measured breach.
 */

const env = {
  DEV_MFA_KEY: "a".repeat(64),
  BCRYPT_COST: "4",
  TRUST_PROXY_HEADERS: "auto",
};
const t0 = new Date("2026-09-15T12:00:00.000Z");

function loginReq(ip = "203.0.113.9"): Request {
  return new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-real-ip": ip, "content-type": "application/json" },
  });
}

describe("S2 pms-app-authz", () => {
  // Negative control: the second sign-in uses a *different* (next-step) code and is accepted.
  it("S2-pms-app-authz-1: a TOTP code that already opened a session is refused when replayed", async () => {
    const store = await createMemoryStore({ now: t0, env, password: DEV_PASSWORD, mfaSecret: DEV_MFA_SECRET });
    const code = currentCodeForTest("ridgeview-owner", DEV_MFA_SECRET, t0.getTime());
    const creds = { username: "ridgeview-owner", password: DEV_PASSWORD, totp: code };

    const first = await authorizeCredentials(store, creds, loginReq(), t0, env);
    expect(first.ok).toBe(true);

    // Same code, same 30 s step, a second later: RFC 6238 §5.2 says a verifier
    // must not accept a second attempt of the same OTP.
    const replay = await authorizeCredentials(store, creds, loginReq(), new Date(t0.getTime() + 1000), env);
    expect(replay).toEqual({ ok: false, reason: "credentials" });
  });

  // Negative control: lockMsFor(8) with the module defaults is 60 s and lockMsFor(9) is 120 s, so the
  // escalation exists in the pure function; the breach is that sign-in never reaches it.
  it("S2-pms-app-authz-2: repeated password failures on one account escalate the lockout beyond the first 15 s", async () => {
    const store = await createMemoryStore({ now: t0, env, password: DEV_PASSWORD, mfaSecret: DEV_MFA_SECRET });
    const ip = "203.0.113.9";
    const key = loginPairKey(ip, "ridgeview-owner");
    const bad = { username: "ridgeview-owner", password: "wrong-password-0.2!", totp: "000000" };

    let now = t0;
    const locks: number[] = [];
    // Three lock cycles: fail until locked, wait for the lock to lapse, fail again.
    for (let cycle = 0; cycle < 4; cycle += 1) {
      for (let i = 0; i < 40; i += 1) {
        await authorizeCredentials(store, bad, loginReq(ip), now, env);
        const row = await store.getThrottle(key);
        if (row?.lockedUntil && row.lockedUntil.getTime() > now.getTime()) {
          locks.push((row.lockedUntil.getTime() - now.getTime()) / 1000);
          now = new Date(row.lockedUntil.getTime() + 1000);
          break;
        }
        now = new Date(now.getTime() + 1000);
      }
    }

    expect(locks).toHaveLength(4);
    expect(locks[0]).toBe(15);
    // The 4th lock in a row (≈24 failures inside the 15 minute window) must be longer than the first.
    expect(locks[3], `lock durations in seconds per cycle: ${JSON.stringify(locks)}`).toBeGreaterThan(locks[0]);
    // And within the window the cap for the account key is MAX_LOCK_MS (15 min), not the IP cap (60 s).
    expect(Math.max(...locks)).toBeGreaterThan(60);
  });

  // Negative control: apps/pms/src/app/api/me/route.ts is a route.ts under src/app and is walked by the checker.
  it("S2-pms-app-authz-3: check:routes walks every server-action module, not only src/app/**/route.ts and *.action.ts", () => {
    const appDir = path.resolve(__dirname, "..", "..");
    const src = path.join(appDir, "src");
    const checker = readFileSync(path.join(appDir, "scripts/check-route-guards.mjs"), "utf8");

    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
    const serverActionModules = walk(src).filter(
      (f) => /\.tsx?$/.test(f) && /^\s*["']use server["']/m.test(readFileSync(f, "utf8"))
    );
    expect(serverActionModules.length).toBeGreaterThan(0);

    // Mirror the checker's own selection: it only walks src/app and only picks
    // route.ts or *.action.ts, so anything else with "use server" is invisible to it
    // unless the checker text names the file explicitly (allowlist).
    const invisible = serverActionModules
      .filter((f) => {
        const rel = path.relative(src, f);
        const underApp = rel.startsWith(`app${path.sep}`);
        const base = path.basename(f);
        const picked = underApp && (base === "route.ts" || base.endsWith(".action.ts"));
        const named = checker.includes(path.relative(appDir, f)) || checker.includes(base);
        return !picked && !named;
      })
      .map((f) => path.relative(appDir, f));

    expect(invisible).toEqual([]);
  });
});
