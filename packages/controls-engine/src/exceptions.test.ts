import { describe, expect, it } from "vitest";
import type { ThresholdException } from "./controls/dual-release";
import { decisionPermitsRetirement, exceptionTightens, validateThresholdException } from "./exceptions";
import { AS_OF } from "./fixtures/live-grants";

function ex(partial: Partial<ThresholdException>): ThresholdException {
  return {
    id: "ex-test",
    label: "Test exception",
    channels: ["ach"],
    action: "lower_threshold",
    thresholdUsd: 100,
    enabled: true,
    reason: "Tighter during the audit.",
    createdAt: AS_OF,
    ...partial,
  };
}

describe("validateThresholdException", () => {
  it("accepts a plain lower_threshold", () => {
    expect(validateThresholdException(ex({}), AS_OF)).toEqual({ ok: true, errors: [] });
  });

  it("requires a residual note and an approving owner for a raise", () => {
    const r = validateThresholdException(ex({ action: "raise_threshold", thresholdUsd: 3500 }), AS_OF);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("A raise or waiver needs a residual note.");
    expect(r.errors).toContain("A raise or waiver needs the approving owner's id.");
    const ok = validateThresholdException(
      ex({
        action: "raise_threshold",
        thresholdUsd: 3500,
        residualNote: "Single release for the lab only.",
        approvedByPersonId: "u-owner",
      }),
      AS_OF,
    );
    expect(ok.ok).toBe(true);
  });

  it("makes every waiver expire within 90 days", () => {
    const base = {
      action: "waive_dual" as const,
      thresholdUsd: undefined,
      residualNote: "Owner accepts residual for the processor refund path.",
      approvedByPersonId: "u-owner",
    };
    expect(validateThresholdException(ex(base), AS_OF).errors).toContain(
      "A waiver must carry an effectiveTo date; waivers always expire.",
    );
    expect(validateThresholdException(ex({ ...base, effectiveTo: "2027-01-01" }), AS_OF).errors[0]).toMatch(
      /at most 90 days/,
    );
    expect(validateThresholdException(ex({ ...base, effectiveTo: "2026-09-01" }), AS_OF).errors[0]).toMatch(
      /already in the past/,
    );
    expect(validateThresholdException(ex({ ...base, effectiveTo: "2026-12-01" }), AS_OF).ok).toBe(true);
  });

  it("refuses a threshold on force_dual, an unknown channel, and a bad window", () => {
    expect(
      validateThresholdException(ex({ action: "force_dual", thresholdUsd: 50 }), AS_OF).errors,
    ).toContain("Only raise_threshold and lower_threshold carry a threshold.");
    expect(validateThresholdException(ex({ channels: ["wire" as never] }), AS_OF).errors).toContain(
      'Unknown channel "wire".',
    );
    expect(
      validateThresholdException(ex({ effectiveFrom: "2026-10-01", effectiveTo: "2026-09-01" }), AS_OF)
        .errors,
    ).toContain("effectiveFrom must not be after effectiveTo.");
    expect(
      validateThresholdException(ex({ amountMinUsd: 500, amountMaxUsd: 100 }), AS_OF).errors,
    ).toContain("amountMinUsd must not exceed amountMaxUsd.");
    expect(validateThresholdException(ex({ thresholdUsd: Infinity }), AS_OF).ok).toBe(false);
  });

  it("refuses an unknown action and mistyped scope fields before they reach the policy", () => {
    expect(validateThresholdException(ex({ action: "bogus" as never, thresholdUsd: undefined }), AS_OF).errors[0]).toMatch(
      /action must be one of/,
    );
    expect(validateThresholdException(ex({ payeeContains: 123 as never }), AS_OF).errors).toContain(
      "payeeContains must be a non-empty string when present.",
    );
    expect(validateThresholdException(ex({ payeeContains: "   " }), AS_OF).ok).toBe(false);
    expect(validateThresholdException(ex({ role: {} as never }), AS_OF).ok).toBe(false);
    expect(validateThresholdException(ex({ enabled: "yes" as never }), AS_OF).errors).toContain(
      "Exception enabled must be true or false.",
    );
    expect(validateThresholdException(ex({ label: 5 as never }), AS_OF).errors).toContain("Exception needs a label.");
  });
});

describe("switching a tightening exception off (Increment 1.31)", () => {
  it("knows which exceptions tighten: force_dual and lower_threshold", () => {
    expect(exceptionTightens(ex({ action: "force_dual" }))).toBe(true);
    expect(exceptionTightens(ex({ action: "lower_threshold" }))).toBe(true);
    expect(exceptionTightens(ex({ action: "raise_threshold" }))).toBe(false);
    expect(exceptionTightens(ex({ action: "waive_dual" }))).toBe(false);
  });

  it("needs an accepting or compensating decision with a review date", () => {
    const monitor = decisionPermitsRetirement({ kind: "monitor", note: "Watching it for now.", reviewBy: "2026-12-01" }, AS_OF);
    expect(monitor.ok).toBe(false);
    expect(monitor.errors).toEqual(["Switching a tightening control off needs an accept_residual or compensate decision."]);

    const noDate = decisionPermitsRetirement({ kind: "accept_residual", note: "Evening clinic runs with two people present." }, AS_OF);
    expect(noDate.ok).toBe(false);
    expect(noDate.errors).toEqual([
      "Switching a tightening control off needs a review date: the day the practice looks at this again.",
    ]);

    const shortNote = decisionPermitsRetirement({ kind: "compensate", note: "short", reviewBy: "2026-12-01" }, AS_OF);
    expect(shortNote.ok).toBe(false);
    expect(shortNote.errors[0]).toMatch(/at least 10 characters/);

    expect(
      decisionPermitsRetirement({ kind: "accept_residual", note: "Evening clinic runs with two people present.", reviewBy: "2026-12-01" }, AS_OF),
    ).toEqual({ ok: true, errors: [] });
  });
});
