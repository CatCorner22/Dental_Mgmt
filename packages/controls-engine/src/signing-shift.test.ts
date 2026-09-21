import { describe, expect, it } from "vitest";
import { defaultDualReleasePolicy, listEligibleApprovers, signingShift } from "./controls/dual-release";
import type { Person } from "./types";

/**
 * What a change of rank moves (Increment 1.78).
 *
 * The premise this increment started from was that a promotion creates
 * segregation-of-duties conflicts the grant path would refuse. It does not:
 * `detectSodConflicts` scores duty combinations from entitlements, and the
 * app builds assignments with `assignmentsFromGrants`, which infers nothing
 * from a role label. A gate modelled on `evaluateGrant` would have been a
 * check that never fires.
 *
 * What a promotion really moves is **signing power**, because the release
 * rules name their signers by label. These cases pin that, so the claim the
 * screen makes to a practice is one the rulebook actually supports.
 */

const policy = defaultDualReleasePolicy();

const people: Person[] = [
  { id: "p-owner", name: "Dr. Reagan", role: "Owner / Dentist", active: true, tenureYears: 12 },
  { id: "p-front", name: "Jordan Blake", role: "Front Desk Lead", active: true, tenureYears: 5 },
];

describe("signingShift", () => {
  it("moves nothing when the label does not change", () => {
    expect(signingShift(policy, people, "p-front", "Front Desk Lead")).toEqual({
      gainedInitiate: [],
      gainedSecond: [],
      lostInitiate: [],
      lostSecond: [],
    });
  });

  it("reports the channels a promotion to the owner's label opens", () => {
    const shift = signingShift(policy, people, "p-front", "Owner / Dentist");
    // The rules name "Owner / Dentist" as a second approver on every channel
    // the default policy carries, which is the whole reason a promotion is a
    // control change rather than a convenience.
    expect(shift.gainedSecond.length).toBeGreaterThan(0);
    for (const channel of shift.gainedSecond) {
      const after = listEligibleApprovers(
        policy,
        channel,
        people.map((p) => (p.id === "p-front" ? { ...p, role: "Owner / Dentist" } : p))
      );
      expect(after.find((p) => p.id === "p-front")?.canSecond).toBe(true);
    }
  });

  it("reports what a demotion takes away, read the same way round", () => {
    const down = signingShift(policy, people, "p-owner", "Front Desk Lead");
    const up = signingShift(policy, people, "p-front", "Owner / Dentist");
    // The two people start from the two labels, so one's losses are the
    // other's gains: a shift that reported only gains would let a practice
    // demote somebody without being told what it was giving up.
    expect(down.lostSecond.sort()).toEqual(up.gainedSecond.sort());
    expect(down.lostInitiate.sort()).toEqual(up.gainedInitiate.sort());
  });

  it("answers about the one person named and nobody else", () => {
    const before = listEligibleApprovers(policy, "writeoff", people);
    signingShift(policy, people, "p-front", "Owner / Dentist");
    // The caller's array is not mutated, so a change that is only considered
    // leaves the practice exactly as it was.
    expect(listEligibleApprovers(policy, "writeoff", people)).toEqual(before);
    expect(people.find((p) => p.id === "p-front")?.role).toBe("Front Desk Lead");
  });

  it("reports nothing for somebody the policy never names", () => {
    const stranger: Person[] = [
      ...people,
      { id: "p-cpa", name: "Prentice & Co", role: "Outside Accountant", active: true, tenureYears: 1 },
    ];
    // Increment 1.49 settled that no release rule names this seat. Moving it
    // between two labels the rules ignore moves nothing.
    expect(signingShift(policy, stranger, "p-cpa", "Hygienist")).toEqual({
      gainedInitiate: [],
      gainedSecond: [],
      lostInitiate: [],
      lostSecond: [],
    });
  });
});
