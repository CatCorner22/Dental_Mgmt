import { describe, expect, it } from "vitest";
import { authorizeCredentials } from "./authorize";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_USERS } from "./devSeed";
import { createMemoryStore } from "./memoryStore";
import { currentCodeForTest } from "./totp";
import { requireAccess } from "./requireAccess";
import { storePorts } from "./storePorts";

const now = new Date("2026-09-15T12:00:00.000Z");
const env = {
  DEV_MFA_KEY: "a".repeat(64),
  BCRYPT_COST: "4",
  TRUST_PROXY_HEADERS: "auto",
};

function loginReq(): Request {
  return new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-real-ip": "203.0.113.9", "content-type": "application/json" },
  });
}

describe("authorizeCredentials", () => {
  it("creates a session when password and TOTP match", async () => {
    const store = await createMemoryStore({ now, env, password: DEV_PASSWORD, mfaSecret: DEV_MFA_SECRET });
    const code = currentCodeForTest("ridgeview-owner", DEV_MFA_SECRET, now.getTime());
    const result = await authorizeCredentials(
      store,
      { username: "ridgeview-owner", password: DEV_PASSWORD, totp: code },
      loginReq(),
      now,
      env
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.username).toBe("ridgeview-owner");
    const session = await store.getSession(result.user.sessionId);
    expect(session?.userId).toBe(DEV_USERS[0].id);
    expect(store.events.some((e) => e.kind === "auth.signin")).toBe(true);
  });

  it("accepts the documented memory-store recovery code", async () => {
    const store = await createMemoryStore({ now, env, password: DEV_PASSWORD, mfaSecret: DEV_MFA_SECRET });
    const result = await authorizeCredentials(
      store,
      { username: "ridgeview-owner", password: DEV_PASSWORD, totp: "dev0-aaaa" },
      loginReq(),
      now,
      env
    );
    expect(result.ok).toBe(true);
  });

  it("accepts a one-time recovery code in the TOTP field", async () => {
    const store = await createMemoryStore({ now, env, password: DEV_PASSWORD, mfaSecret: DEV_MFA_SECRET });
    const ownerId = DEV_USERS[0].id;
    const [code] = store.issuedRecoveryCodes.get(ownerId) ?? [];
    expect(code).toBeTruthy();
    const first = await authorizeCredentials(
      store,
      { username: "ridgeview-owner", password: DEV_PASSWORD, totp: code },
      loginReq(),
      now,
      env
    );
    expect(first.ok).toBe(true);
    const second = await authorizeCredentials(
      store,
      { username: "ridgeview-owner", password: DEV_PASSWORD, totp: code },
      loginReq(),
      now,
      env
    );
    expect(second.ok).toBe(false);
  });

  it("does not distinguish unknown users from a wrong password", async () => {
    const store = await createMemoryStore({ now, env });
    const missing = await authorizeCredentials(
      store,
      { username: "no-such-user", password: DEV_PASSWORD, totp: "123456" },
      loginReq(),
      now,
      env
    );
    const wrong = await authorizeCredentials(
      store,
      { username: "ridgeview-owner", password: "Wrong-password-0.2!", totp: "123456" },
      loginReq(),
      now,
      env
    );
    expect(missing).toEqual({ ok: false, reason: "credentials" });
    expect(wrong).toEqual({ ok: false, reason: "credentials" });
  });

  it("revokes live sessions when the account is deactivated", async () => {
    const store = await createMemoryStore({ now, env, password: DEV_PASSWORD, mfaSecret: DEV_MFA_SECRET });
    const code = currentCodeForTest("ridgeview-owner", DEV_MFA_SECRET, now.getTime());
    const result = await authorizeCredentials(
      store,
      { username: "ridgeview-owner", password: DEV_PASSWORD, totp: code },
      loginReq(),
      now,
      env
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await store.deactivateUser(DEV_USERS[0].id, now);
    const session = await store.getSession(result.user.sessionId);
    expect(session?.revokedAt).toEqual(now);
    const ports = storePorts(store, async () => result.user.sessionId);
    const access = await requireAccess(
      new Request("http://localhost/api/me"),
      {},
      ports,
      now
    );
    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.response.status).toBe(401);
  });
});
