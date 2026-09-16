import { describe, expect, it } from "vitest";
import { authorizeCredentials } from "./authorize";
import { beginMfaEnrollment, completeMfaEnrollment } from "./enrollMfa";
import { DEV_PASSWORD, DEV_USERS } from "./devSeed";
import { createMemoryStore } from "./memoryStore";
import { currentCodeForTest } from "./totp";
import { requireAccess } from "./requireAccess";
import { storePorts } from "./storePorts";

const now = new Date("2026-09-15T12:00:00.000Z");
const env = { DEV_MFA_KEY: "a".repeat(64), BCRYPT_COST: "4" };
const newhire = DEV_USERS.find((u) => u.username === "ridgeview-newhire")!;

function loginReq(): Request {
  return new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-real-ip": "203.0.113.9", "content-type": "application/json" },
  });
}

describe("MFA enrollment", () => {
  it("lets an unenrolled user sign in with password only", async () => {
    const store = await createMemoryStore({ now, env, password: DEV_PASSWORD });
    const result = await authorizeCredentials(
      store,
      { username: newhire.username, password: DEV_PASSWORD, totp: "" },
      loginReq(),
      now,
      env
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.needsMfaEnrollment).toBe(true);
    expect(store.events.some((e) => e.kind === "auth.signin.pending_mfa")).toBe(true);
  });

  it("completes enrollment and then requires TOTP on the next sign-in", async () => {
    const store = await createMemoryStore({ now, env, password: DEV_PASSWORD });
    const login = await authorizeCredentials(
      store,
      { username: newhire.username, password: DEV_PASSWORD, totp: "" },
      loginReq(),
      now,
      env
    );
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    const ports = storePorts(store, async () => login.user.sessionId);
    const blocked = await requireAccess(new Request("http://localhost/api/me"), {}, ports, now);
    expect(blocked.ok).toBe(false);

    await beginMfaEnrollment(store, newhire.id, env);
    const user = await store.getUserById(newhire.id);
    expect(user?.mfaSecretEnc).toBeTruthy();
    const secret = "JBSWY3DPEHPK3PXP";
    // begin generates random secret — read back via decrypt after we control store state:
    const { encryptSecret } = await import("@pms/db/crypto");
    const knownEnc = encryptSecret(secret, env);
    await store.setMfaPendingSecret(newhire.id, knownEnc);
    const code = currentCodeForTest(newhire.username, secret, now.getTime());
    const done = await completeMfaEnrollment(store, newhire.id, code, env, now);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.recoveryCodes.length).toBeGreaterThan(0);

    const enrolled = await store.getUserById(newhire.id);
    expect(enrolled?.mfaEnrolledAt).toEqual(now);

    const code2 = currentCodeForTest(newhire.username, secret, now.getTime());
    const second = await authorizeCredentials(
      store,
      { username: newhire.username, password: DEV_PASSWORD, totp: code2 },
      loginReq(),
      now,
      env
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.user.needsMfaEnrollment).toBeUndefined();
  });
});
