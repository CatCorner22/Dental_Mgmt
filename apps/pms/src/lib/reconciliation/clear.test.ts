import { describe, expect, it } from "vitest";
import { canClearVariance, type CanClearVarianceInput } from "./clear";

const OWNER_ID = "owner-1";
const FRONT_ID = "front-1";
const BOOK_ID = "book-1";

const owner = {
  id: OWNER_ID,
  role: "admin",
  entitlements: ["bank_reconcile", "approve_writeoffs"],
};
const front = {
  id: FRONT_ID,
  role: "user",
  entitlements: ["post_payments", "bank_reconcile"],
};
const bookkeeper = {
  id: BOOK_ID,
  role: "user",
  entitlements: ["bank_reconcile"],
};

const varianceRun = {
  status: "variance",
  source: "statement_import",
  periodStart: "2026-09-14",
  periodEnd: "2026-09-14",
};

function input(overrides: Partial<CanClearVarianceInput>): CanClearVarianceInput {
  return {
    actor: owner,
    run: varianceRun,
    depositsForPeriod: [{ preparedById: FRONT_ID }],
    entitlements: [owner, front],
    paymentPosterIds: [FRONT_ID],
    ...overrides,
  };
}

describe("canClearVariance", () => {
  it("refuses the deposit preparer", () => {
    const result = canClearVariance(
      input({
        actor: front,
        entitlements: [owner, front, bookkeeper],
        paymentPosterIds: [FRONT_ID],
      })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("sod_preparer");
    expect(result.verb).toBe("Needs someone other than the deposit preparer");
    expect(result.degradedOwnerClearance).toBe(false);
  });

  it("allows another reconciler who did not prepare or post", () => {
    const result = canClearVariance(
      input({
        actor: bookkeeper,
        entitlements: [owner, front, bookkeeper],
        paymentPosterIds: [FRONT_ID],
      })
    );
    expect(result).toMatchObject({
      ok: true,
      code: "allowed",
      degradedOwnerClearance: false,
    });
  });

  it("degrades to owner-only clearance when nobody else is eligible", () => {
    const result = canClearVariance(
      input({
        actor: owner,
        depositsForPeriod: [{ preparedById: OWNER_ID }],
        entitlements: [owner, { ...front, entitlements: ["post_payments"] }],
        paymentPosterIds: [OWNER_ID],
      })
    );
    expect(result).toMatchObject({
      ok: true,
      code: "degraded_owner_clearance",
      degradedOwnerClearance: true,
    });
  });

  it("refuses a conflicted owner when another eligible clearer exists", () => {
    const result = canClearVariance(
      input({
        actor: owner,
        depositsForPeriod: [{ preparedById: OWNER_ID }],
        entitlements: [owner, bookkeeper],
        paymentPosterIds: [OWNER_ID],
      })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("sod_preparer");
  });

  it("refuses payment posting + prepared deposit as the named pair", () => {
    const result = canClearVariance(
      input({
        actor: front,
        depositsForPeriod: [{ preparedById: FRONT_ID }],
        entitlements: [owner, front],
        paymentPosterIds: [],
      })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("sod_preparer");
  });

  it("refuses a payment poster even when they did not prepare the deposit", () => {
    const result = canClearVariance(
      input({
        actor: {
          id: "poster-1",
          role: "user",
          entitlements: ["post_payments", "bank_reconcile"],
        },
        depositsForPeriod: [{ preparedById: FRONT_ID }],
        entitlements: [owner, bookkeeper],
        paymentPosterIds: ["poster-1"],
      })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("sod_preparer");
    expect(result.why).toMatch(/posted payments/i);
  });

  it("refuses clearance that is not grounded in a statement import", () => {
    const result = canClearVariance(
      input({
        run: { ...varianceRun, source: "self_assertion" },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_independent");
  });

  it("refuses an already cleared run", () => {
    const result = canClearVariance(
      input({
        run: { ...varianceRun, status: "cleared" },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("already_cleared");
  });

  it("refuses an actor without bank_reconcile", () => {
    const result = canClearVariance(
      input({
        actor: { id: FRONT_ID, role: "user", entitlements: ["post_payments"] },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("missing_entitlement");
  });

  it("allows an independent owner without recording a degraded finding", () => {
    const result = canClearVariance(
      input({
        actor: owner,
        depositsForPeriod: [{ preparedById: FRONT_ID }],
        entitlements: [owner],
        paymentPosterIds: [FRONT_ID],
      })
    );
    expect(result).toMatchObject({
      ok: true,
      code: "allowed",
      degradedOwnerClearance: false,
    });
  });
});
