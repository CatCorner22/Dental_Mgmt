import { describe, expect, it } from "vitest";
import { createMemoryStore, type MemoryStore } from "./memoryStore";
import {
  approveRecoveryCeremony,
  consumeRecoveryCeremony,
  initiateRecoveryCeremony,
} from "./recoveryCeremony";
import { authorizeCredentials } from "./authorize";
import { parseRegainRef } from "./regainLink";
import { currentCodeForTest } from "./totp";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_USERS } from "./devSeed";

const now = new Date("2026-09-15T12:00:00.000Z");
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const newhire = DEV_USERS[2]!;
const NEW_PASSWORD = "New-password-0.6!";

const totp = (username: string) => currentCodeForTest(username, DEV_MFA_SECRET, now.getTime());

/**
 * Ridgeview seeds one administrator; three are made here.
 *
 * Two would not be enough to model the honest case. With only the owner and
 * one other, a recovery *for the owner* would have to be approved by the
 * owner — which `approveRecoveryCeremony` refuses, and which could never
 * happen anyway, since somebody locked out cannot sign in to approve
 * anything. The new hire takes the second part, and is given a factor because
 * an administrator without one can prove nothing.
 */
async function threeAdminStore(): Promise<MemoryStore> {
  const store = await createMemoryStore({ now });
  const owned = (await store.getUserById(owner.id))!;
  for (const id of [front.id, newhire.id]) {
    const person = (await store.getUserById(id))!;
    store.users.set(id, {
      ...person,
      role: "admin",
      mfaSecretEnc: owned.mfaSecretEnc,
      mfaEnrolledAt: owned.mfaEnrolledAt,
    });
  }
  return store;
}

/**
 * Two other administrators take the two parts, so the cases below can name the
 * **owner** as the person locked out. That is the account worth proving: it
 * carries a working factor in the seed, and it is the one a practice most
 * needs back.
 */
async function runToToken(store: MemoryStore, targetUserId: string): Promise<string> {
  const start = await initiateRecoveryCeremony(
    store,
    (await store.getUserById(front.id))!,
    targetUserId,
    totp(front.username),
    2,
    now
  );
  if (!start.ok) throw new Error(`expected ceremony start, got ${start.reason}`);
  const approved = await approveRecoveryCeremony(
    store,
    (await store.getUserById(newhire.id))!,
    start.ceremonyId,
    totp(newhire.username),
    now
  );
  if (!approved.ok) throw new Error(`expected ceremony approval, got ${approved.reason}`);
  return approved.resetToken;
}

describe("recovery ceremony", () => {
  it("requires two distinct admins and resets the target password", async () => {
    const store = await threeAdminStore();
    const start = await initiateRecoveryCeremony(
      store,
      (await store.getUserById(owner.id))!,
      newhire.id,
      totp(owner.username),
      2,
      now
    );
    if (!start.ok) throw new Error("expected ceremony start");

    const same = await approveRecoveryCeremony(
      store,
      (await store.getUserById(owner.id))!,
      start.ceremonyId,
      totp(owner.username),
      now
    );
    expect(same).toMatchObject({ ok: false, reason: "same_admin" });

    const approved = await approveRecoveryCeremony(
      store,
      (await store.getUserById(front.id))!,
      start.ceremonyId,
      totp(front.username),
      now
    );
    if (!approved.ok) throw new Error("expected ceremony approval");
    expect(await consumeRecoveryCeremony(store, approved.resetToken, NEW_PASSWORD, now)).toMatchObject({
      ok: true,
      username: newhire.username,
    });
  });

  /**
   * Increment 1.77. Refusing only the initiator left a confused-deputy shape:
   * one administrator starts a recovery against a second, the second approves
   * it believing they are helping a colleague, and the first walks away with a
   * link into the second's account. The pair would be the attacker and the
   * victim rather than two independent administrators.
   */
  it("refuses the person the recovery is for as its second pair of hands", async () => {
    const store = await threeAdminStore();
    const start = await initiateRecoveryCeremony(
      store,
      (await store.getUserById(front.id))!,
      owner.id,
      totp(front.username),
      2,
      now
    );
    if (!start.ok) throw new Error("expected ceremony start");
    expect(
      await approveRecoveryCeremony(
        store,
        (await store.getUserById(owner.id))!,
        start.ceremonyId,
        totp(owner.username),
        now
      )
    ).toMatchObject({ ok: false, reason: "target_cannot_approve" });
  });

  /**
   * Increment 1.77. `approveRecoveryCeremony` has always refused the person who
   * started it, so a practice with one administrator could open a ceremony that
   * nobody alive could approve — a form nobody can complete. The refusal now
   * lands before the row exists.
   */
  it("refuses to start at all where the practice has fewer than two administrators who could act", async () => {
    const store = await createMemoryStore({ now });
    const before = store.ceremonies.size;
    expect(
      await initiateRecoveryCeremony(
        store,
        (await store.getUserById(owner.id))!,
        newhire.id,
        totp(owner.username),
        1,
        now
      )
    ).toMatchObject({ ok: false, reason: "no_second_admin" });
    // Nothing was written, so no ceremony sits waiting for an approval that
    // cannot come.
    expect(store.ceremonies.size).toBe(before);
  });
});

/**
 * Increment 1.77. Before this, the ceremony reset a password and left the
 * second factor standing — so it could not help the one person it exists for.
 * Somebody whose authenticator is gone finished the reset and met the same
 * demand for a code they cannot produce.
 */
describe("a consumed ceremony clears the second factor", () => {
  it("removes the secret, the enrolment date and every remaining recovery code", async () => {
    const store = await threeAdminStore();
    const before = await store.getUserById(newhire.id);
    // The new hire is unenrolled in the seed, so the owner is the case that
    // matters: an account that carries a working factor.
    expect(before).toBeTruthy();

    const token = await runToToken(store, owner.id);
    const carrying = await store.getUserById(owner.id);
    expect(carrying?.mfaSecretEnc).toBeTruthy();
    expect(carrying?.recoveryCodeHashes.length).toBeGreaterThan(0);

    expect(await consumeRecoveryCeremony(store, token, NEW_PASSWORD, now)).toMatchObject({ ok: true });

    const after = await store.getUserById(owner.id);
    expect(after?.mfaSecretEnc).toBeNull();
    expect(after?.mfaEnrolledAt).toBeNull();
    expect(after?.recoveryCodeHashes).toEqual([]);
    // Nothing is left staged either: a cleared account has no pairing in
    // progress that a later promotion could finish.
    expect(await store.getMfaPendingSecret(owner.id)).toBeNull();
  });

  it("lets the person sign in on the new password alone, and sends them to pair an authenticator", async () => {
    const store = await threeAdminStore();
    const token = await runToToken(store, owner.id);
    await consumeRecoveryCeremony(store, token, NEW_PASSWORD, now);

    const later = new Date(now.getTime() + 60_000);
    const signIn = await authorizeCredentials(
      store,
      { username: owner.username, password: NEW_PASSWORD, totp: "" },
      new Request("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.9", "content-type": "application/json" },
      }),
      later,
      {}
    );
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;
    // Which is the whole of the fix: the account is reachable, and the very
    // next screen is the one Increment 1.76 built.
    expect(signIn.user.needsMfaEnrollment).toBe(true);
  });

  it("refuses the old password, so the reset is a replacement rather than an addition", async () => {
    const store = await threeAdminStore();
    const token = await runToToken(store, owner.id);
    await consumeRecoveryCeremony(store, token, NEW_PASSWORD, now);

    const later = new Date(now.getTime() + 60_000);
    const withOld = await authorizeCredentials(
      store,
      { username: owner.username, password: DEV_PASSWORD, totp: "" },
      new Request("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.10", "content-type": "application/json" },
      }),
      later,
      {}
    );
    expect(withOld.ok).toBe(false);
  });

  it("takes the account's live sessions with it", async () => {
    // The consume used to revoke separately; the revoke now rides inside
    // `clearMfaEnrollment`, so this pins the guarantee rather than the call.
    const store = await threeAdminStore();
    const session = await store.createSession({
      tenantId: owner.tenantId,
      userId: owner.id,
      deviceProfile: "desk",
      userAgent: null,
      now,
    });
    expect((await store.getSession(session.id))?.revokedAt).toBeNull();

    const token = await runToToken(store, owner.id);
    await consumeRecoveryCeremony(store, token, NEW_PASSWORD, now);
    expect((await store.getSession(session.id))?.revokedAt).toEqual(now);
  });

  it("says on the chain that the factor went with the password", async () => {
    const store = await threeAdminStore();
    const token = await runToToken(store, owner.id);
    await consumeRecoveryCeremony(store, token, NEW_PASSWORD, now);
    const consumed = store.events.find((e) => e.kind === "auth.recovery.consumed");
    // One act, one event, and its payload says what the act did rather than
    // leaving a reader to infer it from an increment number.
    expect(consumed?.payload).toMatchObject({ secondFactorCleared: true });
  });

  /**
   * The link the approver is handed has to be one the page will accept.
   * `parseRegainRef` checks its shape before any row is read, so a token minted
   * in one shape and parsed in another would leave every recovery answered
   * "this link is not one we recognise" with nothing failing in either module's
   * own tests.
   */
  it("mints a token the page that reads it will accept", async () => {
    const store = await threeAdminStore();
    expect(parseRegainRef(await runToToken(store, owner.id))).not.toBeNull();
  });

  it("works once: a link already spent changes nothing a second time", async () => {
    const store = await threeAdminStore();
    const token = await runToToken(store, owner.id);
    expect(await consumeRecoveryCeremony(store, token, NEW_PASSWORD, now)).toMatchObject({ ok: true });
    expect(await consumeRecoveryCeremony(store, token, "Another-password-1.7!", now)).toMatchObject({
      ok: false,
      reason: "already_consumed",
    });
  });
});
