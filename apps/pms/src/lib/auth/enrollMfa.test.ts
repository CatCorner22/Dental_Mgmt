import { describe, expect, it } from "vitest";
import { authorizeCredentials } from "./authorize";
import { beginMfaEnrollment, completeMfaEnrollment } from "./enrollMfa";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_USERS } from "./devSeed";
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

    const started = await beginMfaEnrollment(store, newhire.id, env);
    // Increment 1.76: starting a pairing stages the new authenticator and
    // leaves the live secret alone. This account has none yet, so it stays
    // null — and on an account that has one, that is what stops a person who
    // opens this screen and changes their mind from being locked out.
    expect(started.repairing).toBe(false);
    expect(await store.getMfaPendingSecret(newhire.id)).toBeTruthy();
    const user = await store.getUserById(newhire.id);
    expect(user?.mfaSecretEnc).toBeNull();
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

/**
 * Increment 1.76. Before this, an account's second factor was a one-way door:
 * `mfaEnrolledAt` was written once and cleared nowhere, both enrolment
 * functions refused an account that carried it, recovery codes only ever
 * decreased, and the screen that could mint a new set bounced anybody already
 * enrolled. Ten sign-ins on codes and a lost phone left an account nobody
 * could ever reach — the practice owner's included.
 */
describe("re-pairing an authenticator", () => {
  const owner = DEV_USERS.find((u) => u.username === "ridgeview-owner")!;
  const secondPhone = "KRSXG5CTMVRXEZLU";
  // Nothing below means anything if the "new" authenticator is the seeded one.
  expect(secondPhone).not.toBe(DEV_MFA_SECRET);

  async function enrolledStore() {
    const store = await createMemoryStore({ now, env, password: DEV_PASSWORD });
    const user = await store.getUserById(owner.id);
    expect(user?.mfaEnrolledAt).toBeTruthy();
    return store;
  }

  it("starts a pairing on an account that already has a factor", async () => {
    const store = await enrolledStore();
    const started = await beginMfaEnrollment(store, owner.id, env);
    expect(started.ok).toBe(true);
    // The screen says which act this is, so the words a person reads match
    // what pressing the button will do.
    expect(started.repairing).toBe(true);
  });

  it("leaves the working factor alone until a code from the new one comes back", async () => {
    // The trap this increment had to avoid: `setMfaPendingSecret` used to
    // write the live secret, so merely OPENING the screen would have replaced
    // a working authenticator with one nobody had paired yet. A person who
    // changed their mind would have been locked out immediately rather than
    // eventually — the countdown made instant.
    const store = await enrolledStore();
    const before = await store.getUserById(owner.id);
    await beginMfaEnrollment(store, owner.id, env);
    const after = await store.getUserById(owner.id);
    expect(after?.mfaSecretEnc).toEqual(before?.mfaSecretEnc);
    expect(after?.mfaEnrolledAt).toEqual(before?.mfaEnrolledAt);
    expect(after?.recoveryCodeHashes).toEqual(before?.recoveryCodeHashes);
    // And the staged one is somewhere else entirely.
    expect(await store.getMfaPendingSecret(owner.id)).toBeTruthy();
  });

  it("refuses a code from the factor already on the account", async () => {
    // A pairing completes on the authenticator being paired, never on the one
    // already there: otherwise a code the person already holds would finish a
    // pairing nobody started, and silently reissue their recovery codes.
    const store = await enrolledStore();
    await beginMfaEnrollment(store, owner.id, env);
    // The seeded factor itself, so this refusal is about the live secret
    // rather than about any wrong code.
    const live = currentCodeForTest(owner.username, DEV_MFA_SECRET, now.getTime());
    expect(await completeMfaEnrollment(store, owner.id, live, env, now)).toMatchObject({
      ok: false,
      reason: "invalid_code",
    });
  });

  it("replaces the factor and mints a fresh set of codes, which is what ends the countdown", async () => {
    const store = await enrolledStore();
    const before = await store.getUserById(owner.id);
    await beginMfaEnrollment(store, owner.id, env);
    const { encryptSecret } = await import("@pms/db/crypto");
    await store.setMfaPendingSecret(owner.id, encryptSecret(secondPhone, env));

    const done = await completeMfaEnrollment(
      store,
      owner.id,
      currentCodeForTest(owner.username, secondPhone, now.getTime()),
      env,
      now
    );
    expect(done).toMatchObject({ ok: true, repaired: true });
    if (!done.ok) return;
    expect(done.recoveryCodes).toHaveLength(10);

    const after = await store.getUserById(owner.id);
    expect(after?.mfaSecretEnc).not.toEqual(before?.mfaSecretEnc);
    // The supply is restored rather than merely stopped from falling, which is
    // the whole of the fix: the same act that pairs the new phone reissues the
    // codes that reach it.
    expect(after?.recoveryCodeHashes).toHaveLength(10);
    expect(after?.recoveryCodeHashes).not.toEqual(before?.recoveryCodeHashes);
    // Nothing is left staged: a pairing is in progress or finished, never both.
    expect(await store.getMfaPendingSecret(owner.id)).toBeNull();
  });

  it("signs in on the new authenticator and no longer on the old one", async () => {
    const store = await enrolledStore();
    await beginMfaEnrollment(store, owner.id, env);
    const { encryptSecret } = await import("@pms/db/crypto");
    await store.setMfaPendingSecret(owner.id, encryptSecret(secondPhone, env));
    await completeMfaEnrollment(store, owner.id, currentCodeForTest(owner.username, secondPhone, now.getTime()), env, now);

    const later = new Date(now.getTime() + 60_000);
    const withNew = await authorizeCredentials(
      store,
      { username: owner.username, password: DEV_PASSWORD, totp: currentCodeForTest(owner.username, secondPhone, later.getTime()) },
      loginReq(),
      later,
      env
    );
    expect(withNew.ok).toBe(true);

    const withOld = await authorizeCredentials(
      store,
      { username: owner.username, password: DEV_PASSWORD, totp: currentCodeForTest(owner.username, DEV_MFA_SECRET, later.getTime()) },
      loginReq(),
      later,
      env
    );
    expect(withOld.ok).toBe(false);
  });

  it("names the act on the chain, so a factor that changed reads differently from one first set", async () => {
    const store = await enrolledStore();
    await beginMfaEnrollment(store, owner.id, env);
    const { encryptSecret } = await import("@pms/db/crypto");
    await store.setMfaPendingSecret(owner.id, encryptSecret(secondPhone, env));
    await completeMfaEnrollment(store, owner.id, currentCodeForTest(owner.username, secondPhone, now.getTime()), env, now);
    expect(store.events.some((e) => e.kind === "auth.mfa_repaired")).toBe(true);
    expect(store.events.some((e) => e.kind === "auth.mfa_enrolled")).toBe(false);
  });
});

