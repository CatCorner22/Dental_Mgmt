import { describe, expect, it } from "vitest";
import {
  lineDetail,
  lineSentence,
  planUnmatchedFindings,
  severityForAge,
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
    detectorVersion: "detectors-v1",
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
        row({ id: "other", kind: "decision_unreviewed", subjectKind: "control_decision", subjectId: "d1" }),
      ],
      [line({}), line({ bankTransactionId: "t2" }), line({ bankTransactionId: "t4" }), line({ bankTransactionId: "t4" })]
    );
    expect(plan.refresh.map((r) => r.row.id)).toEqual(["f1"]);
    expect(plan.reopens.map((r) => r.row.id)).toEqual(["f2"]);
    expect(plan.inserts.map((l) => l.bankTransactionId)).toEqual(["t4"]);
    expect(plan.closes.map((r) => r.id)).toEqual(["f3"]);
  });
});
