import { describe, expect, it } from "vitest";
import { canonicalizeEventPayload } from "@pms/db";
import { assertFlatPayload } from "./events";

describe("assertFlatPayload", () => {
  it("accepts primitives, nulls, and arrays of primitives", () => {
    expect(() =>
      assertFlatPayload({
        grantId: "g1",
        entitlement: "bank_reconcile",
        newConflictIds: ["u:rule-cash-rec"],
        newConflictScores: [88],
        decisionIds: [],
        reason: null,
        ok: true,
      })
    ).not.toThrow();
  });

  it("refuses nested objects, which the chain hash would not bind", () => {
    expect(() => assertFlatPayload({ newConflicts: [{ id: "x", score: 90 }] })).toThrow(/nested objects/);
    expect(() => assertFlatPayload({ headline: { averageResidual: 41 } })).toThrow(/nested object/);
  });

  it("documents why: the canonicalizer drops nested keys absent from the top level", () => {
    const nested = { grantId: "g1", newConflicts: [{ id: "x", score: 90 }] };
    expect(canonicalizeEventPayload(nested)).toBe('{"grantId":"g1","newConflicts":[{}]}');
    const flat = { grantId: "g1", newConflictIds: ["x"], newConflictScores: [90] };
    expect(canonicalizeEventPayload(flat)).toBe('{"grantId":"g1","newConflictIds":["x"],"newConflictScores":[90]}');
  });
});
