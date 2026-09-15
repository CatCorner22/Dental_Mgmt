import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memoryStore";
import {
  approveRecoveryCeremony,
  consumeRecoveryCeremony,
  initiateRecoveryCeremony,
} from "./recoveryCeremony";
import { currentCodeForTest } from "./totp";
import { DEV_MFA_SECRET, DEV_USERS } from "./devSeed";

const now = new Date("2026-09-15T12:00:00.000Z");
const owner = DEV_USERS[0];
const front = DEV_USERS[1];
const newhire = DEV_USERS[2];

describe("recovery ceremony", () => {
  it("requires two distinct admins and resets the target password", async () => {
    const store = await createMemoryStore({ now });
    const secondAdmin = (await store.getUserById(front.id))!;
    store.users.set(front.id, { ...secondAdmin, role: "admin" });
    const totp = (username: string) => currentCodeForTest(username, DEV_MFA_SECRET, now.getTime());

    const start = await initiateRecoveryCeremony(
      store,
      (await store.getUserById(owner.id))!,
      newhire.id,
      totp(owner.username),
      now
    );
    if (!start.ok) throw new Error("expected ceremony start");
    const ceremonyId = start.ceremonyId;

    const same = await approveRecoveryCeremony(
      store,
      (await store.getUserById(owner.id))!,
      ceremonyId,
      totp(owner.username),
      now
    );
    expect(same.ok).toBe(false);

    const approved = await approveRecoveryCeremony(
      store,
      (await store.getUserById(front.id))!,
      ceremonyId,
      totp(front.username),
      now
    );
    if (!approved.ok) throw new Error("expected ceremony approval");
    const consumed = await consumeRecoveryCeremony(
      store,
      approved.resetToken,
      "New-password-0.6!",
      now
    );
    expect(consumed.ok).toBe(true);
  });
});
