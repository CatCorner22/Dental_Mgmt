import { describe, expect, it } from "vitest";
import { CPA_SEAT_ENTITLEMENT } from "../auth/seats";
import { needsAnAddress, setupSentence } from "./setup";

/**
 * Who the practice needs to be able to reach (Increment 1.70).
 *
 * The rule worth proving is the scope: this reports the people who could act
 * on what a notice says, and nobody else. A reading that named the whole
 * roster would be a card nobody reads, and one that named too few would hide
 * the failure it exists to surface.
 */
describe("needsAnAddress", () => {
  it("counts an owner, who can open the screen the practice's notices point at", () => {
    expect(needsAnAddress({ role: "admin", entitlements: ["approve_writeoffs"] })).toBe(true);
  });

  it("counts a manager, because rank and not ownership is what opens the board", () => {
    expect(needsAnAddress({ role: "manager", entitlements: [] })).toBe(true);
  });

  it("counts the outside accountant, whose one grant opens the one screen they are sent to", () => {
    expect(needsAnAddress({ role: "readonly", entitlements: [CPA_SEAT_ENTITLEMENT] })).toBe(true);
  });

  it("leaves out somebody who cannot act on a single notice, however many other screens they open", () => {
    // The front desk posts payments, imports, closes the day and reads
    // statements — four screens — and can discharge none of the four things a
    // notice ever says. An address is theirs to give (Increment 1.58); the
    // practice does not need one to do its own job.
    expect(needsAnAddress({ role: "user", entitlements: ["post_payments", "run_import"] })).toBe(false);
    expect(needsAnAddress({ role: "lead", entitlements: ["bank_reconcile"] })).toBe(false);
    expect(needsAnAddress({ role: "readonly", entitlements: [] })).toBe(false);
  });

  it("reads a role it does not know as reaching nothing, rather than as reaching everything", () => {
    expect(needsAnAddress({ role: "superuser" as never, entitlements: [] })).toBe(false);
  });
});

describe("setupSentence", () => {
  it("says what has never happened and what would change it", () => {
    const said = setupSentence({ name: "Mel Manager", seat: "owner", withdrawn: false });
    expect(said).toContain("Mel Manager");
    expect(said).toContain("never said where");
    expect(said).toContain("save an address and prove it");
  });

  it("names the accountant's seat, because the package is what reaches nobody", () => {
    expect(setupSentence({ name: "Casey Prentice", seat: "accountant", withdrawn: false })).toContain(
      "outside accountant's seat"
    );
  });

  it("calls a withdrawal a decision rather than a fault, and still says what it costs", () => {
    const said = setupSentence({ name: "Mel Manager", seat: "owner", withdrawn: true });
    expect(said).toContain("their decision");
    expect(said).toContain("cannot tell them anything");
    expect(said).not.toContain("never said where");
  });
});
