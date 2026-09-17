import { describe, expect, it } from "vitest";
import type { ControlDecision, ReconciliationMeasurementSummary, ThresholdException } from "@pms/controls-engine";
import { dayBefore, daysAfter, decisionsDue, expiringExceptions, yesterdayTile, type CloseForBoard, type RunForBoard } from "./board";

const asOf = "2026-09-17";

const independent: ReconciliationMeasurementSummary = {
  grade: "independent",
  windowDays: 45,
  clearedInWindow: 1,
  sameHandsInWindow: 0,
  latestClearedAt: "2026-09-16T18:00:00Z",
  why: "1 run cleared from a bank statement in the last 45 days, by someone who neither prepared deposits nor posted payments in the period.",
};

function run(over: Partial<RunForBoard>): RunForBoard {
  return { runId: "r1", source: "statement_import", status: "cleared", openVarianceCount: 0, createdAt: "2026-09-16T12:00:00Z", ...over };
}

function close(over: Partial<CloseForBoard>): CloseForBoard {
  return { locationName: "Main", status: "frozen", depositCount: 2, depositTotalCents: 35_000, daySheetTotalCents: 35_000, ...over };
}

describe("yesterdayTile", () => {
  it("shows no green state without a bank record", () => {
    const t = yesterdayTile({ asOf, closes: [close({})], runs: [run({ source: "self_assertion" })], reconciliation: independent });
    expect(t).toMatchObject({ businessDate: "2026-09-16", shape: "triangle", headline: "No bank record yet" });
    expect(t.action).toEqual({ label: "Import a statement", href: "/reconciliation" });
    expect(t.why).toMatch(/self-assertion/);
  });

  it("counts open variances across runs and points at the newest run that has one", () => {
    const t = yesterdayTile({
      asOf,
      closes: [],
      runs: [
        run({ runId: "old", status: "variance", openVarianceCount: 1, createdAt: "2026-09-10T12:00:00Z" }),
        run({ runId: "new", status: "variance", openVarianceCount: 2, createdAt: "2026-09-16T12:00:00Z" }),
        run({ runId: "clean" }),
      ],
      reconciliation: independent,
    });
    expect(t).toMatchObject({ shape: "triangle", headline: "3 variances" });
    expect(t.action?.href).toBe("/reconciliation/new");
    expect(t.why).toMatch(/3 bank lines have no matching deposit and no clearance yet, across 2 runs/);
    expect(yesterdayTile({ asOf, closes: [], runs: [run({ openVarianceCount: 1, status: "variance" })], reconciliation: independent }).headline).toBe("1 variance");
  });

  it("asks for the close when yesterday had activity and is still open, but not for an idle day", () => {
    const t = yesterdayTile({ asOf, closes: [close({ status: "open" }), close({ locationName: "North", status: "open", depositCount: 0, depositTotalCents: 0, daySheetTotalCents: 0 })], runs: [run({})], reconciliation: independent });
    expect(t).toMatchObject({ shape: "half", headline: "Yesterday not closed" });
    expect(t.why).toMatch(/at Main and the day is not frozen/);
    expect(t.action?.href).toBe("/day-close");
    const idle = yesterdayTile({ asOf, closes: [close({ status: "open", depositCount: 0, depositTotalCents: 0, daySheetTotalCents: 0 })], runs: [run({})], reconciliation: independent });
    expect(idle.headline).toBe("Tied · independent");
  });

  it("grades a tied day by who cleared it, in words about hands rather than people", () => {
    expect(yesterdayTile({ asOf, closes: [close({})], runs: [run({})], reconciliation: independent })).toMatchObject({
      shape: "filled",
      headline: "Tied · independent",
      action: null,
    });
    const same = yesterdayTile({
      asOf,
      closes: [],
      runs: [run({})],
      reconciliation: { ...independent, grade: "same_hands", sameHandsInWindow: 1, why: "1 of 1 run cleared in the last 45 days was cleared by someone who prepared deposits or posted payments in the period, including owner-only clearance recorded as a finding." },
    });
    expect(same).toMatchObject({ shape: "half", headline: "Tied · needs a second look" });
    expect(same.why).toMatch(/^The same hands posted or prepared deposits and cleared the bank reconciliation\./);
    expect(same.why).not.toMatch(/Riley|Finn/);
    const stale = yesterdayTile({ asOf, closes: [], runs: [run({ status: "cleared" })], reconciliation: { ...independent, grade: "stale_import", clearedInWindow: 0, why: "No reconciliation run cleared from a bank statement in the last 45 days." } });
    expect(stale).toMatchObject({ shape: "half", headline: "Tied · last clearance is stale" });
  });
});

function decision(over: Partial<ControlDecision>): ControlDecision {
  return {
    id: "d1",
    subjectKind: "sod_finding",
    subjectId: "u-1:rule-cash-rec",
    kind: "accept_residual",
    note: "Owner reconciles on Fridays.",
    reviewBy: "2026-10-01",
    decidedById: "u-owner",
    decidedByName: "Riley Owner",
    decidedAt: "2026-09-01T12:00:00Z",
    ...over,
  };
}

describe("decisionsDue", () => {
  it("lists active decisions due within 30 days, overdue first, and skips superseded ones", () => {
    const due = decisionsDue(
      [
        decision({}),
        decision({ id: "d2", reviewBy: "2026-09-10", subjectId: "u-2:rule-writeoff" }),
        decision({ id: "d3", reviewBy: "2026-12-01" }),
        decision({ id: "d4", reviewBy: "2026-09-05", subjectId: "old" }),
        decision({ id: "d5", supersedesDecisionId: "d4", reviewBy: "2026-11-01", subjectId: "old" }),
        decision({ id: "d6", reviewBy: undefined }),
      ],
      asOf
    );
    expect(due.map((d) => d.id)).toEqual(["d2", "d1"]);
    expect(due[0]).toMatchObject({ overdue: true, kindLabel: "Accept residual", reviewBy: "2026-09-10", decidedAt: "2026-09-01T12:00:00Z" });
    expect(due[1]).toMatchObject({ overdue: false, reviewBy: "2026-10-01" });
    expect(daysAfter(asOf, 30)).toBe("2026-10-17");
    expect(dayBefore(asOf)).toBe("2026-09-16");
  });

  it("drops a decision once a retirement supersedes it, and never lists the retirement itself", () => {
    const due = decisionsDue(
      [
        decision({ id: "d1", reviewBy: "2026-09-20" }),
        decision({ id: "d1-retired", kind: "retire", reviewBy: undefined, supersedesDecisionId: "d1", note: "The duty moved to the bookkeeper." }),
        decision({ id: "d2", reviewBy: "2026-09-25", subjectId: "u-2:rule-writeoff" }),
      ],
      asOf
    );
    expect(due.map((d) => d.id)).toEqual(["d2"]);
  });
});

function exception(over: Partial<ThresholdException>): ThresholdException {
  return {
    id: "x1",
    label: "Lab ACH raise",
    channels: ["ach"],
    action: "raise_threshold",
    thresholdUsd: 5000,
    enabled: true,
    reason: "Lab bills run high in September.",
    createdAt: "2026-09-01",
    effectiveFrom: "2026-09-01",
    effectiveTo: "2026-09-25",
    ...over,
  };
}

describe("expiringExceptions", () => {
  it("lists enabled exceptions ending within 14 days, soonest first, and skips disabled, expired, and open-ended ones", () => {
    const out = expiringExceptions(
      [
        exception({}),
        exception({ id: "today", effectiveTo: "2026-09-17" }),
        exception({ id: "gone", effectiveTo: "2026-09-16" }),
        exception({ id: "far", effectiveTo: "2026-11-01" }),
        exception({ id: "off", enabled: false, effectiveTo: "2026-09-20" }),
        exception({ id: "open", effectiveTo: undefined }),
      ],
      asOf
    );
    expect(out.map((e) => [e.id, e.daysLeft])).toEqual([
      ["today", 0],
      ["x1", 8],
    ]);
  });
});
