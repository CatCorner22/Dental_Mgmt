import { describe, expect, it } from "vitest";
import { daysBetween, matchingSummary, measureMatching, median, resolvedOn, type BankLineFacts } from "./matchingMeasure";

const asOf = "2026-09-16";

function line(over: Partial<BankLineFacts>): BankLineFacts {
  return {
    bankTransactionId: "t1",
    postedDate: "2026-09-10",
    amountCents: 25_000,
    importedOn: "2026-09-11",
    matched: true,
    status: "matched",
    clearedOn: null,
    ...over,
  };
}

describe("measureMatching", () => {
  it("counts only lines posted inside the window and at least 48 hours old", () => {
    const m = measureMatching(
      [
        line({ bankTransactionId: "young", postedDate: "2026-09-15" }), // yesterday: not due yet
        line({ bankTransactionId: "edge", postedDate: "2026-09-14", importedOn: "2026-09-14" }), // exactly two days old: counts
        line({ bankTransactionId: "old", postedDate: "2026-08-01" }), // before the 45-day window
        line({ bankTransactionId: "start", postedDate: "2026-08-02", importedOn: "2026-08-02" }), // window start, inclusive
      ],
      asOf
    );
    expect(m).toMatchObject({ windowStart: "2026-08-02", cohortEnd: "2026-09-14", linesInWindow: 2, creditsInWindow: 2 });
    expect(measureMatching([line({ postedDate: "2026-09-15" })], asOf)).toMatchObject({
      linesInWindow: 0,
      matchRate48hPct: null,
      medianLagDays: null,
    });
    expect(measureMatching([], asOf).why).toMatch(/nothing to measure/);
  });

  it("takes the lag to the match, the clearance, or today for an open line, and says which", () => {
    expect(daysBetween("2026-09-10", "2026-09-12")).toBe(2);
    expect(resolvedOn(line({}), asOf)).toEqual({ on: "2026-09-11", open: false });
    expect(resolvedOn(line({ matched: false, status: "cleared", clearedOn: "2026-09-13" }), asOf)).toEqual({ on: "2026-09-13", open: false });
    expect(resolvedOn(line({ matched: false, status: "open" }), asOf)).toEqual({ on: asOf, open: true });

    const m = measureMatching(
      [
        line({ bankTransactionId: "a", postedDate: "2026-09-10", importedOn: "2026-09-11" }), // lag 1, matched within
        line({ bankTransactionId: "b", postedDate: "2026-09-08", importedOn: "2026-09-11" }), // lag 3, matched late
        line({ bankTransactionId: "c", postedDate: "2026-09-08", amountCents: -15_000, matched: false, status: "cleared", importedOn: "2026-09-11", clearedOn: "2026-09-12" }), // debit, lag 4
        line({ bankTransactionId: "d", postedDate: "2026-09-06", matched: false, status: "open", importedOn: "2026-09-11" }), // open credit, lag 10 so far
      ],
      asOf
    );
    expect(m).toMatchObject({
      linesInWindow: 4,
      creditsInWindow: 3,
      creditsMatched: 2,
      creditsMatchedWithinDue: 1,
      matchRate48hPct: 33.3,
      medianLagDays: 3.5,
      maxLagDays: 10,
      openLines: 1,
    });
    expect(m.why).toBe(
      "1 of 3 bank credits matched a practice deposit within 48 hours (33.3%); median detection lag 3.5 days across 4 bank lines, 1 still open and counted at its age today. Debits are not matched yet and count toward lag only."
    );
  });

  it("reads a clean statement as a full rate and a whole-day median", () => {
    const m = measureMatching(
      [
        line({ bankTransactionId: "a", postedDate: "2026-09-12", importedOn: "2026-09-14" }),
        line({ bankTransactionId: "b", postedDate: "2026-09-12", importedOn: "2026-09-14" }),
        line({ bankTransactionId: "c", postedDate: "2026-09-11", amountCents: -1, matched: false, status: "cleared", importedOn: "2026-09-14", clearedOn: "2026-09-14" }),
      ],
      asOf
    );
    expect(m).toMatchObject({ matchRate48hPct: 100, medianLagDays: 2, maxLagDays: 3, openLines: 0 });
    expect(m.why).toBe(
      "2 of 2 bank credits matched a practice deposit within 48 hours (100%); median detection lag 2 days across 3 bank lines. Debits are not matched yet and count toward lag only."
    );
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1])).toBe(2.5);
  });

  it("leaves the rate undefined when the window holds only debits", () => {
    const m = measureMatching([line({ amountCents: -5_000, matched: false, status: "open", importedOn: "2026-09-11" })], asOf);
    expect(m).toMatchObject({ creditsInWindow: 0, matchRate48hPct: null, medianLagDays: 6, openLines: 1 });
    expect(m.why).toMatch(/^No bank credit posted in the window, so the 48-hour match rate is not defined; median detection lag 6 days/);
  });

  it("summarises for the snapshot without the cohort bounds", () => {
    const m = measureMatching([line({})], asOf);
    const s = matchingSummary(m);
    expect(s).toEqual({
      windowDays: 45,
      dueDays: 2,
      linesInWindow: 1,
      creditsInWindow: 1,
      creditsMatched: 1,
      creditsMatchedWithinDue: 1,
      matchRate48hPct: 100,
      medianLagDays: 1,
      maxLagDays: 1,
      openLines: 0,
      why: m.why,
    });
    expect("asOf" in s).toBe(false);
  });
});
