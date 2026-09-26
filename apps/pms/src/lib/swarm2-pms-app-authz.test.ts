import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
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
  // Control: a sign-in with the *next-step* code (t0 + 30 s) is still accepted, so a fix
  // that refuses everything would fail this test too.
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

    // The code stays inside verifyMfaCode's ±1-step window for up to ~90 s; it must stay refused.
    const late = await authorizeCredentials(store, creds, loginReq(), new Date(t0.getTime() + 29_000), env);
    expect(late).toEqual({ ok: false, reason: "credentials" });

    const t1 = new Date(t0.getTime() + 30_000);
    const nextCode = currentCodeForTest("ridgeview-owner", DEV_MFA_SECRET, t1.getTime());
    expect(nextCode).not.toBe(code);
    const next = await authorizeCredentials(store, { ...creds, totp: nextCode }, loginReq(), t1, env);
    expect(next.ok).toBe(true);
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

  // Runs the real checker (scripts/check-route-guards.mjs) against a planted tree instead of
  // mirroring its selection logic. Positive control: a bare `export async function GET` in a
  // src/app/**/route.ts is caught (exit 1). The breach: a bare server action is not, whether
  // it lives in a *.action.ts the checker does walk (its regexes only match HTTP verb names)
  // or in a "use server" module outside src/app (never walked, never allowlisted).
  it("S2-pms-app-authz-3: check:routes fails on a bare server action, not only on bare HTTP-verb route handlers", () => {
    const appDir = path.resolve(__dirname, "..", "..");
    const repoDir = path.resolve(appDir, "..", "..");
    const root = mkdtempSync(path.join(os.tmpdir(), "route-guards-"));
    const tmp = path.join(root, "apps/pms");
    const catalog = "packages/controls-engine/src/sod/conflict-rules.ts";
    const run = () =>
      spawnSync(process.execPath, [path.join(tmp, "scripts/check-route-guards.mjs")], { encoding: "utf8" });
    try {
      mkdirSync(path.join(tmp, "scripts"), { recursive: true });
      mkdirSync(path.dirname(path.join(root, catalog)), { recursive: true });
      copyFileSync(path.join(repoDir, catalog), path.join(root, catalog));
      copyFileSync(path.join(appDir, "scripts/check-route-guards.mjs"), path.join(tmp, "scripts/check-route-guards.mjs"));
      mkdirSync(path.join(tmp, "src/app/api/planted"), { recursive: true });
      mkdirSync(path.join(tmp, "src/lib"), { recursive: true });
      // The checker also audits its own UNCALLED list against the routes present,
      // so the planted app carries the one route that list names.
      const uncalled = "src/app/api/controls/policy/route.ts";
      mkdirSync(path.dirname(path.join(tmp, uncalled)), { recursive: true });
      copyFileSync(path.join(appDir, uncalled), path.join(tmp, uncalled));

      writeFileSync(
        path.join(tmp, "src/app/api/planted/route.ts"),
        `export async function GET() { return new Response("x"); }\n`
      );
      const control = run();
      expect(control.status, `positive control: ${control.stdout}${control.stderr}`).toBe(1);
      expect(control.stderr).toMatch(/planted\/route\.ts/);
      rmSync(path.join(tmp, "src/app/api/planted/route.ts"));
      expect(run().status).toBe(0);

      writeFileSync(
        path.join(tmp, "src/app/api/planted/save.action.ts"),
        `"use server";\nexport async function saveThing(formData: FormData) { return formData; }\n`
      );
      const actionFile = run();
      expect(
        actionFile.status,
        `bare server action in a walked *.action.ts passed: ${actionFile.stdout}${actionFile.stderr}`
      ).toBe(1);
      rmSync(path.join(tmp, "src/app/api/planted/save.action.ts"));

      writeFileSync(
        path.join(tmp, "src/lib/planted.ts"),
        `"use server";\nexport async function plantedAction() { return 1; }\n`
      );
      const libModule = run();
      expect(
        libModule.status,
        `bare "use server" module outside src/app passed: ${libModule.stdout}${libModule.stderr}`
      ).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
