import { describe, expect, it } from "vitest";
import {
  glBucketForKind,
  mapPostRefusal,
  normalizeAmountCents,
  POSTABLE_KINDS,
} from "./post";

describe("postLedger helpers", () => {
  it("normalizes staff-entered positive amounts by kind", () => {
    expect(normalizeAmountCents("charge", 12500)).toBe(12500);
    expect(normalizeAmountCents("patient_payment", 12500)).toBe(-12500);
    expect(normalizeAmountCents("write_off", -12500)).toBe(-12500);
    expect(normalizeAmountCents("adjustment", 500)).toBe(-500);
  });

  it("rejects zero amounts", () => {
    expect(() => normalizeAmountCents("charge", 0)).toThrow("non-zero");
  });

  it("maps guarded refusals for the API", () => {
    const mapped = mapPostRefusal({
      ok: false,
      code: "blocked_same_person",
      verb: "Choose a different approver",
      control: "Dual release",
      why: "Initiator cannot approve their own request.",
    });
    expect(mapped).toEqual({
      ok: false,
      status: "refused",
      code: "blocked_same_person",
      verb: "Choose a different approver",
      control: "Dual release",
      why: "Initiator cannot approve their own request.",
    });
  });

  it("returns null for successful post results", () => {
    expect(
      mapPostRefusal({
        ok: true,
        entry: {
          id: "e1",
          tenantId: "t1",
          accountId: "a1",
          patientId: "p1",
          locationId: "l1",
          kind: "patient_payment",
          glBucket: "patient_ar",
          amountCents: -100,
          currency: "USD",
          effectiveDate: "2026-09-14",
          postedAt: "2026-09-14T12:00:00.000Z",
          createdById: "u1",
          createdByName: "Poster",
          idempotencyKey: "k1",
        },
        allocations: [],
      })
    ).toBeNull();
  });

  it("exposes the four staff-facing posting kinds", () => {
    expect(POSTABLE_KINDS).toEqual([
      "charge",
      "patient_payment",
      "adjustment",
      "write_off",
    ]);
    expect(glBucketForKind("write_off")).toBe("patient_ar");
  });
});
