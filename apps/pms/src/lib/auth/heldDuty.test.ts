import { describe, expect, it } from "vitest";
import { dutyLabel, dutyNeededSentence, holdsDuty } from "./heldDuty";
import type { Viewer } from "./viewer";

const present = (entitlements: string[]): Viewer => ({
  state: "present",
  username: "ridgeview-owner",
  displayName: "Riley Owner",
  role: "admin",
  entitlements,
});

describe("holdsDuty", () => {
  it("is true only when the viewer holds the duty", () => {
    expect(holdsDuty(present(["post_payments"]), "post_payments")).toBe(true);
    expect(holdsDuty(present(["bank_reconcile"]), "post_payments")).toBe(false);
  });

  /**
   * The seeded owner is the case this increment was found on: an administrator
   * who does not hold `post_payments`, and was offered two acts that need it.
   */
  it("does not read rank as a duty", () => {
    expect(holdsDuty(present(["approve_writeoffs", "run_import", "bank_reconcile"]), "post_payments")).toBe(false);
  });

  it("is false for a viewer this screen could not read", () => {
    expect(holdsDuty({ state: "ended", why: "…" }, "post_payments")).toBe(false);
    expect(holdsDuty({ state: "unknown", why: "…" }, "post_payments")).toBe(false);
  });
});

describe("dutyLabel", () => {
  it("names the duty as the rest of the product does", () => {
    expect(dutyLabel("post_payments")).toBe("Post payments in PMS");
    expect(dutyLabel("bank_reconcile")).toBe("Reconcile bank to PMS");
  });

  it("falls back to the id rather than inventing a name", () => {
    expect(dutyLabel("not_a_duty")).toBe("not_a_duty");
  });
});

describe("dutyNeededSentence", () => {
  it("names the act, the duty and who grants it", () => {
    const said = dutyNeededSentence("Creating a statement", "post_payments");
    expect(said).toContain("Creating a statement");
    expect(said).toContain("Post payments in PMS");
    expect(said).toContain("An administrator grants it on Practice Risk");
  });
});
