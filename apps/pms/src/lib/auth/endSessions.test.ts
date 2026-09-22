import { describe, expect, it, vi } from "vitest";
import { endSessionsForPerson, endedSentence } from "./endSessions";
import type { AuthStore, StoredUser } from "./store";

const TENANT = "tenant-a";
const OTHER = "tenant-b";
const AT = new Date("2026-09-22T11:00:00.000Z");

function person(over: Partial<StoredUser> = {}): StoredUser {
  return {
    id: "user-2",
    tenantId: TENANT,
    username: "finn-front",
    displayName: "Finn Front",
    role: "user",
    clinicalRole: "unset",
    active: true,
    passwordHash: "x",
    mfaSecretEnc: null,
    mfaEnrolledAt: AT,
    recoveryCodeHashes: [],
    passwordChangedAt: AT,
    entitlements: [],
    ...over,
  } as StoredUser;
}

function storeWith(user: StoredUser | null, revoked = 2) {
  const appendDomainEvent = vi.fn(async () => {});
  const revokeSessionsForUser = vi.fn(async () => revoked);
  const store = { getUserById: async () => user, revokeSessionsForUser, appendDomainEvent } as unknown as AuthStore;
  return { store, appendDomainEvent, revokeSessionsForUser };
}

const actor = { id: "user-1", name: "Riley Owner" };

describe("endSessionsForPerson", () => {
  it("ends the named person's sessions and records the act", async () => {
    const { store, appendDomainEvent, revokeSessionsForUser } = storeWith(person());
    const result = await endSessionsForPerson(store, { tenantId: TENANT, actor, targetUserId: "user-2", at: AT });
    expect(result).toEqual({ ok: true, revoked: 2, displayName: "Finn Front" });
    expect(revokeSessionsForUser).toHaveBeenCalledWith("user-2", AT);
    expect(appendDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        actorUserId: "user-1",
        kind: "auth.sessions_ended",
        payload: { targetUserId: "user-2", targetUsername: "finn-front", revoked: 2, by: "Riley Owner" },
      })
    );
  });

  /**
   * `store.revokeSessionsForUser` resolves the target's own tenant, so it will
   * end a session in any practice if handed an id from one. The guard is here.
   */
  it("refuses a person in another practice, and ends nothing", async () => {
    const { store, revokeSessionsForUser, appendDomainEvent } = storeWith(person({ tenantId: OTHER }));
    const result = await endSessionsForPerson(store, { tenantId: TENANT, actor, targetUserId: "user-2", at: AT });
    expect(result).toMatchObject({ ok: false, status: 404, code: "not_in_practice" });
    expect(revokeSessionsForUser).not.toHaveBeenCalled();
    expect(appendDomainEvent).not.toHaveBeenCalled();
  });

  it("answers an unknown person exactly as one in another practice", async () => {
    const missing = await endSessionsForPerson(storeWith(null).store, { tenantId: TENANT, actor, targetUserId: "nobody", at: AT });
    const elsewhere = await endSessionsForPerson(storeWith(person({ tenantId: OTHER })).store, {
      tenantId: TENANT,
      actor,
      targetUserId: "user-2",
      at: AT,
    });
    expect(missing).toEqual(elsewhere);
  });

  it("refuses the actor's own sessions, and says where to sign out instead", async () => {
    const { store, revokeSessionsForUser } = storeWith(person({ id: "user-1" }));
    const result = await endSessionsForPerson(store, { tenantId: TENANT, actor, targetUserId: "user-1", at: AT });
    expect(result).toMatchObject({ ok: false, status: 409, code: "self" });
    if (result.ok) return;
    expect(result.why).toContain("sign out");
    expect(revokeSessionsForUser).not.toHaveBeenCalled();
  });
});

describe("endedSentence", () => {
  it("counts one sign-in in the singular", () => {
    expect(endedSentence("Finn Front", 1)).toContain("Ended 1 sign-in for Finn Front");
  });

  it("counts several in the plural", () => {
    expect(endedSentence("Finn Front", 3)).toContain("Ended 3 sign-ins for Finn Front");
  });

  /** Nothing signed in is the outcome the owner wanted, not a failure. */
  it("says plainly when there was nothing left to end", () => {
    const said = endedSentence("Finn Front", 0);
    expect(said).toContain("had no sessions left to end");
    expect(said).not.toContain("Ended 0");
  });
});
