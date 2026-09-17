import { describe, expect, it } from "vitest";
import type { ControlDecision } from "@pms/controls-engine";
import {
  DEGRADED_CLEARANCE_KIND,
  DECISION_UNREVIEWED_KIND,
  degradedRunCandidate,
  degradedRunSentence,
  lineDetail,
  lineSentence,
  overdueDecisionCandidate,
  overdueDecisions,
  planFindings,
  planUnmatchedFindings,
  severityForAge,
  severityForOverdue,
  UNMATCHED_BANK_LINE_KIND,
  type ControlFindingRow,
  type OpenBankLine,
} from "./detectors";

function line(over: Partial<OpenBankLine>): OpenBankLine {
  return {
    bankTransactionId: "t1",
    bankAccountId: "b1",
    runId: "r1",
    postedDate: "2026-09-14",
    amountCents: -15_000,
    description: "ACH MERCHANT FEE",
    ageDays: 3,
    ...over,
  };
}

function row(over: Partial<ControlFindingRow>): ControlFindingRow {
  return {
    id: "f1",
    tenantId: "tenant",
    kind: UNMATCHED_BANK_LINE_KIND,
    subjectKind: "bank_transaction",
    subjectId: "t1",
    severity: "low",
    status: "open",
    detail: {},
    detectorVersion: "detectors-v2",
    firstSeenAt: new Date("2026-09-16T06:00:00Z"),
    lastSeenAt: new Date("2026-09-16T06:00:00Z"),
    closedAt: null,
    closedReason: null,
    reopenedCount: 0,
    ...over,
  };
}

describe("unmatched bank line detector", () => {
  it("grades severity by age and words the finding about the line, not a person", () => {
    expect(severityForAge(0)).toBe("low");
    expect(severityForAge(6)).toBe("low");
    expect(severityForAge(7)).toBe("medium");
    expect(severityForAge(30)).toBe("medium");
    expect(severityForAge(31)).toBe("high");
    expect(lineSentence(line({}))).toBe(
      "A $150.00 bank debit posted 2026-09-14 (ACH MERCHANT FEE) has had no matching deposit and no clearance for 3 days."
    );
    expect(lineSentence(line({ amountCents: 123_456, description: "DEPOSIT", ageDays: 1 }))).toBe(
      "A $1,234.56 bank credit posted 2026-09-14 (DEPOSIT) has had no matching deposit and no clearance for 1 day."
    );
    const detail = lineDetail(line({}));
    expect(Object.values(detail).every((v) => typeof v !== "object")).toBe(true);
    expect(detail).toMatchObject({ postedDate: "2026-09-14", amountCents: -15_000, runId: "r1", ageDays: 3 });
  });

  it("opens new lines, refreshes open ones, reopens closed ones that recur, and closes the rest", () => {
    const plan = planUnmatchedFindings(
      [
        row({}),
        row({ id: "f2", subjectId: "t2", status: "closed", closedAt: new Date(), closedReason: "matched or cleared" }),
        row({ id: "f3", subjectId: "t3" }),
        row({ id: "other", kind: DECISION_UNREVIEWED_KIND, subjectKind: "control_decision", subjectId: "d1" }),
      ],
      [line({}), line({ bankTransactionId: "t2" }), line({ bankTransactionId: "t4" }), line({ bankTransactionId: "t4" })]
    );
    expect(plan.refresh.map((r) => r.row.id)).toEqual(["f1"]);
    expect(plan.reopens.map((r) => r.row.id)).toEqual(["f2"]);
    expect(plan.inserts.map((c) => c.subjectId)).toEqual(["t4"]);
    expect(plan.insertedLines.map((l) => l.bankTransactionId)).toEqual(["t4"]);
    expect(plan.closes.map((r) => r.id)).toEqual(["f3"]);
  });
});

describe("owner-only clearance detector", () => {
  it("records the run and the process at medium severity, naming no one", () => {
    const run = { runId: "r9", bankAccountId: "b1", periodStart: "2026-09-14", periodEnd: "2026-09-15", clearedOn: "2026-09-17" };
    expect(degradedRunSentence(run)).toBe(
      "The reconciliation run for 2026-09-14 to 2026-09-15 was cleared on 2026-09-17 as owner-only clearance: no other eligible person existed, so the same hands that recorded or prepared also cleared. The control was not disabled; this row records that it ran degraded."
    );
    expect(degradedRunCandidate(run)).toMatchObject({ subjectId: "r9", severity: "medium", detail: { clearedOn: "2026-09-17" } });
    // The generic planner keeps kinds apart: a bank-line row of the same subject id is untouched.
    const plan = planFindings(
      [row({ id: "bank", subjectId: "r9" }), row({ id: "old", kind: DEGRADED_CLEARANCE_KIND, subjectKind: "reconciliation_run", subjectId: "r8" })],
      DEGRADED_CLEARANCE_KIND,
      "reconciliation_run",
      [degradedRunCandidate(run)]
    );
    expect(plan.inserts.map((c) => c.subjectId)).toEqual(["r9"]);
    expect(plan.closes.map((r) => r.id)).toEqual(["old"]);
    expect(plan.refresh).toEqual([]);
  });
});

function decision(over: Partial<ControlDecision>): ControlDecision {
  return {
    id: "d1",
    subjectKind: "sod_finding",
    subjectId: "u-1:rule-cash-rec",
    kind: "accept_residual",
    note: "Owner reconciles on Fridays.",
    reviewBy: "2026-09-01",
    decidedById: "u-owner",
    decidedByName: "Riley Owner",
    decidedAt: "2026-08-01T12:00:00Z",
    ...over,
  };
}

describe("unreviewed decision detector", () => {
  it("lists active decisions past review, grades by how long, and words the finding without the decider's name", () => {
    const asOf = "2026-09-17";
    const due = overdueDecisions(
      [
        decision({}),
        decision({ id: "d2", reviewBy: "2026-09-17" }), // due today: not yet past
        decision({ id: "d3", reviewBy: "2026-07-01", subjectId: "u-2:rule-writeoff" }),
        decision({ id: "d4", supersedesDecisionId: "d3", reviewBy: "2026-12-01", subjectId: "u-2:rule-writeoff" }),
        decision({ id: "d5", reviewBy: undefined }),
      ],
      asOf
    );
    expect(due.map((d) => [d.decisionId, d.daysOverdue])).toEqual([["d1", 16]]);
    expect(severityForOverdue(30)).toBe("medium");
    expect(severityForOverdue(31)).toBe("high");
    const c = overdueDecisionCandidate(due[0]!);
    expect(c).toMatchObject({ subjectId: "d1", severity: "medium", detail: { reviewBy: "2026-09-01", daysOverdue: 16 } });
    expect(c.detail.sentence).toBe(
      'A "Accept residual" decision on sod finding u-1:rule-cash-rec was due for review on 2026-09-01 and has been past that date for 16 days. It still governs until a new decision supersedes it.'
    );
    expect(String(c.detail.sentence)).not.toMatch(/Riley/);
  });
});
