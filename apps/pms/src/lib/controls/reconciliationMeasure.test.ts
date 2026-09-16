import { describe, expect, it } from "vitest";
import { gradeReconciliation, gradeRun, measurementSummary, windowStartFor, type RunFacts } from "./reconciliationMeasure";

const asOf = "2026-09-16";

function run(over: Partial<RunFacts>): RunFacts {
  return {
    runId: "r1",
    source: "statement_import",
    status: "cleared",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-07",
    clearedAt: "2026-09-08T18:00:00Z",
    clearedById: "u-owner",
    clearedByName: "Riley Owner",
    degradedOwnerClearance: false,
    clearerHeldCustodyOrRecording: false,
    ...over,
  };
}

describe("gradeReconciliation", () => {
  it("is stale when nothing cleared from a bank source inside the window", () => {
    expect(gradeReconciliation([], asOf)).toMatchObject({ grade: "stale_import", independentBankRec: false, clearedInWindow: 0 });
    // An open run, a run cleared before the window, and a run from no bank source do not count.
    const m = gradeReconciliation(
      [
        run({ status: "open", clearedAt: null }),
        run({ runId: "old", clearedAt: "2026-07-01T00:00:00Z" }),
        run({ runId: "self", source: "self_assertion" }),
      ],
      asOf
    );
    expect(m.grade).toBe("stale_import");
    expect(m.why).toMatch(/last 45 days/);
  });

  it("is independent only when every cleared run in the window is independent", () => {
    const m = gradeReconciliation([run({}), run({ runId: "r2", clearedAt: "2026-09-15T18:00:00Z" })], asOf);
    expect(m).toMatchObject({ grade: "independent", independentBankRec: true, clearedInWindow: 2, sameHandsInWindow: 0 });
    expect(m.latest?.runId).toBe("r2");
    expect(m.why).toMatch(/2 runs cleared .* each by someone who neither prepared deposits nor posted payments/);
  });

  it("is same hands when any run in the window was cleared by a preparer or poster, or owner-only", () => {
    const m = gradeReconciliation([run({}), run({ runId: "r2", clearerHeldCustodyOrRecording: true })], asOf);
    expect(m).toMatchObject({ grade: "same_hands", independentBankRec: false, sameHandsInWindow: 1, independentInWindow: 1 });
    expect(m.why).toMatch(/1 of 2 runs .* was cleared by someone who prepared deposits or posted payments/);
    const degraded = gradeReconciliation([run({ degradedOwnerClearance: true })], asOf);
    expect(degraded.grade).toBe("same_hands");
    expect(degraded.why).toMatch(/owner-only clearance recorded as a finding/);
    expect(gradeRun(run({ degradedOwnerClearance: true }))).toBe("same_hands");
  });

  it("does not count a clearance dated after asOf, and the window is inclusive at its start", () => {
    expect(windowStartFor(asOf, 45)).toBe("2026-08-02");
    const edge = gradeReconciliation([run({ clearedAt: "2026-08-02T00:00:00Z" })], asOf);
    expect(edge.grade).toBe("independent");
    const future = gradeReconciliation([run({ clearedAt: "2026-09-17T00:00:00Z" })], asOf);
    expect(future.grade).toBe("stale_import");
  });

  it("summarises for the snapshot without the per-run detail", () => {
    const m = gradeReconciliation([run({})], asOf);
    expect(measurementSummary(m)).toEqual({
      grade: "independent",
      windowDays: 45,
      clearedInWindow: 1,
      sameHandsInWindow: 0,
      latestClearedAt: "2026-09-08T18:00:00Z",
      why: m.why,
    });
  });
});
