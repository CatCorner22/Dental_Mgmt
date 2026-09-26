import { describe, expect, it } from "vitest";
import type { ControlDecision } from "@pms/controls-engine";
import type { DualReleasePolicy } from "@pms/controls-engine";
import {
  backdatedPostingCandidates,
  DEGRADED_CLEARANCE_KIND,
  DECISION_UNREVIEWED_KIND,
  degradedRunCandidate,
  degradedRunSentence,
  depositNotBankedCandidates,
  duplicatePaymentCandidates,
  dutyHolders,
  governingFindingDecision,
  summarizeFindings,
  soleHolderCandidates,
  severityForBankingGap,
  lineDetail,
  lineSentence,
  overdueDecisionCandidate,
  overdueDecisions,
  planFindings,
  planUnmatchedFindings,
  releaseWithoutApprovalCandidates,
  sealedDayPostingCandidates,
  severityForAge,
  severityForBackdate,
  severityForOverdue,
  severityForSealedDayPostings,
  UNMATCHED_BANK_LINE_KIND,
  type ControlFindingRow,
  type LedgerEntryFacts,
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
      'A "Accept residual" decision on sod finding u-1:rule-cash-rec was due for review on 2026-09-01 and has been past that date for 16 days. It no longer governs: the subject reads as undecided until a new decision is recorded.'
    );
    expect(String(c.detail.sentence)).not.toMatch(/Riley/);
  });
});

function entry(over: Partial<LedgerEntryFacts>): LedgerEntryFacts {
  return {
    id: "e1",
    accountId: "acct-1",
    kind: "write_off",
    amountCents: -50_000,
    effectiveDate: "2026-09-10",
    postedOn: "2026-09-10",
    approvalRequestId: null,
    appliedExceptionId: null,
    reversesEntryId: null,
    correctsEntryId: null,
    closedDayId: null,
    ...over,
  };
}

const policy: DualReleasePolicy = {
  enabled: true,
  ownerCanSecondAny: true,
  hardBlockWithoutSecond: false,
  rules: [
    { channel: "writeoff", label: "Write-offs", enabled: true, thresholdUsd: 150, requireDistinctPeople: true, firstApproverRoles: [], secondApproverRoles: [], mitigatesRuleIds: [], processIds: [], description: "" },
    { channel: "check", label: "Checks", enabled: false, thresholdUsd: 500, requireDistinctPeople: true, firstApproverRoles: [], secondApproverRoles: [], mitigatesRuleIds: [], processIds: [], description: "" },
  ],
  exceptions: [],
};

describe("release without approval detector", () => {
  it("alarms only on a guarded, enabled channel above threshold with neither an approval nor an exception", () => {
    const out = releaseWithoutApprovalCandidates(
      [
        entry({}), // $500 write-off, nothing cited: alarm
        entry({ id: "ok-approved", approvalRequestId: "req-1" }),
        entry({ id: "ok-exception", appliedExceptionId: "x-1" }),
        entry({ id: "ok-small", amountCents: -15_000 }), // at the threshold, not above
        entry({ id: "ok-charge", kind: "charge", amountCents: 90_000 }), // not a guarded channel
        entry({ id: "ok-check-off", kind: "refund", amountCents: -90_000 }), // channel rule disabled
      ],
      policy
    );
    expect(out.map((c) => c.subjectId)).toEqual(["e1"]);
    expect(out[0]).toMatchObject({ severity: "high", detail: { channel: "writeoff", thresholdUsd: 150, amountCents: -50_000 } });
    expect(out[0]!.detail.sentence).toBe(
      "A $500.00 write-off posted 2026-09-10 cites neither an approved request nor a policy exception, and the active policy holds the writeoff channel to dual release above $150.00. The database trigger should have refused this row; treat it as a chain-integrity alarm."
    );
    expect(releaseWithoutApprovalCandidates([entry({})], null)).toEqual([]);
    expect(releaseWithoutApprovalCandidates([entry({})], { ...policy, enabled: false })).toEqual([]);
  });
});

describe("backdated posting detector", () => {
  it("flags reversals, adjustments, and write-offs posted more than seven days after their effective date", () => {
    const out = backdatedPostingCandidates([
      entry({}), // same day
      entry({ id: "week", effectiveDate: "2026-09-03", postedOn: "2026-09-10" }), // exactly seven days: not flagged
      entry({ id: "late", kind: "adjustment", amountCents: -2_000, effectiveDate: "2026-08-20", postedOn: "2026-09-10" }), // 21 days
      entry({ id: "old", kind: "reversal", amountCents: 10_000, effectiveDate: "2026-07-01", postedOn: "2026-09-10" }), // 71 days
      entry({ id: "payment", kind: "patient_payment", amountCents: -10_000, effectiveDate: "2026-07-01", postedOn: "2026-09-10" }), // not a corrected kind
    ]);
    expect(out.map((c) => [c.subjectId, c.severity])).toEqual([
      ["late", "medium"],
      ["old", "high"],
    ]);
    expect(out[0]!.detail.sentence).toBe("A $20.00 adjustment effective 2026-08-20 was posted on 2026-09-10, 21 days after its effective date.");
    expect(severityForBackdate(30)).toBe("medium");
    expect(severityForBackdate(31)).toBe("high");
  });
});

describe("first posting into a sealed day detector", () => {
  it("flags first postings the database stamped, and leaves both halves of a correction alone", () => {
    const out = sealedDayPostingCandidates([
      entry({ id: "open-day", kind: "patient_payment", amountCents: -4_000 }), // never stamped
      entry({
        id: "late",
        kind: "patient_payment",
        amountCents: -4_000,
        effectiveDate: "2026-09-14",
        postedOn: "2026-09-18",
        closedDayId: "close-1",
      }),
      // Both halves of a correction into the same sealed day: a correction names the
      // entry it replaces, so it announces itself and is not this detector's business.
      entry({ id: "rev", kind: "reversal", amountCents: 20_000, effectiveDate: "2026-09-14", postedOn: "2026-09-18", closedDayId: "close-1", correctsEntryId: "x" }),
      entry({ id: "repost", kind: "write_off", amountCents: -15_000, effectiveDate: "2026-09-14", postedOn: "2026-09-18", closedDayId: "close-1", correctsEntryId: "x" }),
    ]);
    expect(out.map((c) => [c.subjectId, c.severity])).toEqual([["late", "medium"]]);
    expect(out[0]!.detail).toMatchObject({ sealedDay: "2026-09-14", postedOn: "2026-09-18", closedDayId: "close-1", postingsBehindThatSeal: 1 });
    expect(out[0]!.detail.sentence).toBe(
      "A $40.00 patient payment posted 2026-09-18 landed against 2026-09-14, a day the practice had already sealed. The sealed figures do not move, so that day's count and that day's ledger now differ."
    );
    expect(String(out[0]!.detail.sentence)).not.toMatch(/Riley|Finn|Jordan/);
  });

  it("reads a second first posting behind one seal as a pattern rather than a slip", () => {
    const shared = { effectiveDate: "2026-09-14", postedOn: "2026-09-18", closedDayId: "close-1", kind: "patient_payment" };
    const out = sealedDayPostingCandidates([
      entry({ id: "a", amountCents: -4_000, ...shared }),
      entry({ id: "b", amountCents: -6_000, ...shared }),
      // A different seal, on its own, stays a slip.
      entry({ id: "c", amountCents: -1_000, effectiveDate: "2026-09-11", postedOn: "2026-09-18", closedDayId: "close-2", kind: "patient_payment" }),
    ]);
    expect(out.map((c) => [c.subjectId, c.severity])).toEqual([
      ["a", "high"],
      ["b", "high"],
      ["c", "medium"],
    ]);
    expect(out[0]!.detail.sentence).toMatch(/2 first postings have landed behind that seal\.$/);
    expect(out[2]!.detail.sentence).not.toMatch(/have landed behind that seal/);
    expect(severityForSealedDayPostings(1)).toBe("medium");
    expect(severityForSealedDayPostings(2)).toBe("high");
  });
});

describe("duplicate patient payment detector", () => {
  it("flags the later of two same-amount same-day payments on one account, and stops once one is reversed", () => {
    const a = entry({ id: "p1", kind: "patient_payment", amountCents: -10_000, effectiveDate: "2026-09-14", postedOn: "2026-09-14" });
    const b = entry({ id: "p2", kind: "patient_payment", amountCents: -10_000, effectiveDate: "2026-09-14", postedOn: "2026-09-15" });
    const other = entry({ id: "p3", kind: "patient_payment", amountCents: -10_000, effectiveDate: "2026-09-14", postedOn: "2026-09-14", accountId: "acct-2" });
    const diff = entry({ id: "p4", kind: "patient_payment", amountCents: -12_000, effectiveDate: "2026-09-14", postedOn: "2026-09-14" });
    const out = duplicatePaymentCandidates([b, a, other, diff]);
    expect(out.map((c) => c.subjectId)).toEqual(["p2"]);
    expect(out[0]).toMatchObject({ severity: "low", detail: { firstEntryId: "p1", count: 2 } });
    expect(out[0]!.detail.sentence).toBe(
      "2 patient payments of $100.00 on one account carry the effective date 2026-09-14, and none has been reversed. This row is the later one; the first stands as posted."
    );
    const reversal = entry({ id: "r1", kind: "reversal", amountCents: 10_000, reversesEntryId: "p2", effectiveDate: "2026-09-15", postedOn: "2026-09-15" });
    expect(duplicatePaymentCandidates([a, b, reversal])).toEqual([]);
  });
});

describe("deposit not banked detector", () => {
  it("flags unmatched deposits once the banking lag has passed, graded by age, and skips matched or young ones", () => {
    const out = depositNotBankedCandidates(
      [
        { depositId: "d-old", bankAccountId: "b1", businessDate: "2026-08-20", method: "Cash", amountCents: 25_000, reference: null, matched: false }, // 28 days
        { depositId: "d-due", bankAccountId: "b1", businessDate: "2026-09-12", method: "Check", amountCents: 10_000, reference: "1042", matched: false }, // exactly 5 days
        { depositId: "d-young", bankAccountId: "b1", businessDate: "2026-09-13", method: "Cash", amountCents: 5_000, reference: null, matched: false }, // 4 days
        { depositId: "d-matched", bankAccountId: "b1", businessDate: "2026-08-01", method: "Cash", amountCents: 5_000, reference: null, matched: true },
      ],
      "2026-09-17"
    );
    expect(out.map((c) => [c.subjectId, c.severity])).toEqual([
      ["d-old", "high"],
      ["d-due", "medium"],
    ]);
    expect(out[1]!.detail.sentence).toBe("A $100.00 check deposit prepared for 2026-09-12 has no matching bank credit after 5 days.");
    expect(severityForBankingGap(14)).toBe("medium");
    expect(severityForBankingGap(15)).toBe("high");
  });
});

describe("sole holder detector", () => {
  it("counts live holders of the highest-weight duties among active people and flags exactly one", () => {
    const rows = [
      { id: "u1", displayName: "Riley", role: "admin", clinicalRole: "unset", active: true, createdAt: new Date(), entitlements: ["bank_reconcile", "approve_writeoffs", "run_import"] },
      { id: "u2", displayName: "Finn", role: "user", clinicalRole: "unset", active: true, createdAt: new Date(), entitlements: ["bank_reconcile", "post_payments"] },
      { id: "u3", displayName: "Gone", role: "user", clinicalRole: "unset", active: false, createdAt: new Date(), entitlements: ["approve_writeoffs", "collect_cash"] },
    ];
    const holders = dutyHolders({ rows });
    expect(Object.fromEntries(holders.map((h) => [h.entitlement, h.activeHolders]))).toEqual({
      collect_cash: 0,
      prepare_deposit: 0,
      bank_reconcile: 2,
      approve_writeoffs: 1,
      create_vendor: 0,
      release_payment: 0,
    });
    const out = soleHolderCandidates(holders);
    expect(out.map((c) => c.subjectId)).toEqual(["approve_writeoffs"]);
    expect(out[0]).toMatchObject({ severity: "medium", detail: { label: "Approve write-offs / adjustments", activeHolders: 1 } });
    expect(out[0]!.detail.sentence).toBe(
      '"Approve write-offs / adjustments" is held by one active person only. If that person is away, no one can perform it and no one can check it: the practice depends on one set of hands for this duty.'
    );
    expect(String(out[0]!.detail.sentence)).not.toMatch(/Riley|Finn/);
  });
});

describe("decisions on findings", () => {
  const rows = [
    { id: "f1", status: "open", severity: "high" },
    { id: "f2", status: "open", severity: "medium" },
    { id: "f3", status: "closed", severity: "low" },
  ] as const;

  it("takes the latest active decision on the finding and ignores superseded, other-subject, and other-kind rows", () => {
    const decisions = [
      decision({ id: "old", subjectKind: "detector_finding", subjectId: "f1", kind: "monitor", decidedAt: "2026-09-01T12:00:00Z" }),
      decision({ id: "new", subjectKind: "detector_finding", subjectId: "f1", kind: "accept_residual", supersedesDecisionId: "old", decidedAt: "2026-09-10T12:00:00Z" }),
      decision({ id: "other", subjectKind: "detector_finding", subjectId: "f9", kind: "monitor" }),
      decision({ id: "sod", subjectKind: "sod_finding", subjectId: "f2", kind: "monitor" }),
    ];
    expect(governingFindingDecision("f1", decisions)?.id).toBe("new");
    expect(governingFindingDecision("f2", decisions)).toBeUndefined();
    expect(governingFindingDecision("f3", decisions)).toBeUndefined();
  });

  it("splits the open rows by whether a decision governs them, and leaves closed rows out of both counts", () => {
    const decisions = [
      decision({ id: "d-f1", subjectKind: "detector_finding", subjectId: "f1", kind: "monitor" }),
      decision({ id: "d-f3", subjectKind: "detector_finding", subjectId: "f3", kind: "monitor" }),
    ];
    expect(summarizeFindings([...rows], decisions)).toEqual({ open: 2, closed: 1, high: 1, medium: 1, low: 0, decided: 1, undecided: 1 });
    expect(summarizeFindings([...rows], [])).toMatchObject({ decided: 0, undecided: 2 });
  });
});
