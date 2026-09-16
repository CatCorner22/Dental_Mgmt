import { describe, expect, it } from "vitest";
import { mergeDualReleasePolicy, type Person } from "@pms/controls-engine";
import { canSealDeposits } from "./seal";

const owner: Person = { id: "u-owner", name: "Riley Owner", role: "Owner / Dentist", active: true, tenureYears: 12 };
const om: Person = { id: "u-om", name: "Maya Chen", role: "Office Manager", active: true, tenureYears: 7 };
const front: Person = { id: "u-front", name: "Finn Front", role: "Front Desk Lead", active: true, tenureYears: 3 };
const hyg: Person = { id: "u-hyg", name: "Sam Ortiz", role: "Hygienist", active: true, tenureYears: 4 };
const people = [owner, om, front, hyg];
const policy = mergeDualReleasePolicy({ enabled: true, exceptions: [] });
const bag = [
  { preparedById: "u-front", amountCents: 25000 },
  { preparedById: "u-front", amountCents: 10000 },
];

describe("canSealDeposits", () => {
  it("records, not enforces, when dual release is off for the practice or the channel", () => {
    expect(canSealDeposits({ actor: { id: "u-front", name: "Finn Front", role: "user" }, deposits: bag, policy: null, people }))
      .toMatchObject({ ok: true, status: "policy_off", dualRequired: false });
    const off = mergeDualReleasePolicy({ enabled: false });
    expect(canSealDeposits({ actor: { id: "u-front", name: "Finn Front", role: "user" }, deposits: bag, policy: off, people }).status).toBe(
      "policy_off"
    );
    const channelOff = mergeDualReleasePolicy({ enabled: true, rules: [{ channel: "deposit", enabled: false } as never] });
    expect(canSealDeposits({ actor: { id: "u-front", name: "Finn Front", role: "user" }, deposits: bag, policy: channelOff, people }).status).toBe(
      "policy_off"
    );
  });

  it("refuses the preparer sealing their own bag when someone else could count it", () => {
    const v = canSealDeposits({ actor: { id: "u-front", name: "Finn Front", role: "user" }, deposits: bag, policy, people });
    expect(v).toMatchObject({ ok: false, status: "blocked_same_person", dualRequired: true, degradedOwnerSeal: false });
    expect(v.otherEligibleNames).toEqual(expect.arrayContaining(["Maya Chen", "Riley Owner"]));
  });

  it("lets a different, eligible person seal", () => {
    const v = canSealDeposits({ actor: { id: "u-om", name: "Maya Chen", role: "manager" }, deposits: bag, policy, people });
    expect(v).toMatchObject({ ok: true, status: "approved_dual", degradedOwnerSeal: false, preparerIds: ["u-front"] });
  });

  it("refuses a role the rule does not allow to second", () => {
    const v = canSealDeposits({ actor: { id: "u-hyg", name: "Sam Ortiz", role: "user" }, deposits: bag, policy, people });
    expect(v).toMatchObject({ ok: false, status: "blocked_role" });
    expect(v.why).toMatch(/may not second a deposit/);
  });

  it("degrades to owner-only sealing when nobody else can count, and says so", () => {
    const solo = [owner];
    const ownBag = [{ preparedById: "u-owner", amountCents: 25000 }];
    const v = canSealDeposits({ actor: { id: "u-owner", name: "Riley Owner", role: "admin" }, deposits: ownBag, policy, people: solo });
    expect(v).toMatchObject({ ok: true, status: "degraded_owner_seal", degradedOwnerSeal: true });
    // With another eligible counter present, the owner who prepared is refused like anyone else.
    const notSolo = canSealDeposits({ actor: { id: "u-owner", name: "Riley Owner", role: "admin" }, deposits: ownBag, policy, people });
    expect(notSolo).toMatchObject({ ok: false, status: "blocked_same_person" });
  });

  it("needs one count only at or under the channel threshold", () => {
    const raised = mergeDualReleasePolicy({ enabled: true, rules: [{ channel: "deposit", enabled: true, thresholdUsd: 500 } as never] });
    const small = [{ preparedById: "u-front", amountCents: 20000 }];
    expect(canSealDeposits({ actor: { id: "u-front", name: "Finn Front", role: "user" }, deposits: small, policy: raised, people })).toMatchObject({
      ok: true,
      status: "below_threshold",
      thresholdUsd: 500,
    });
  });
});
