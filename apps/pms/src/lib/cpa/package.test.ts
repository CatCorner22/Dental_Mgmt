import { describe, expect, it } from "vitest";
import { hashedView, isMonth, monthPeriod, packageHash, packageRows, toCsv, PACKAGE_SCHEMA_VERSION, PACKAGE_SCOPE, type MonthPackage } from "./package";
import { SCOPE_SENTENCE } from "../digest/digest";

function pkg(over: Partial<MonthPackage> = {}): MonthPackage {
  return {
    month: "2026-09",
    period: { start: "2026-09-01", end: "2026-09-30", days: 30 },
    journal: {
      rows: [
        { bucket: "patient_ar", kind: "patient_payment", label: "patient ar · Patient payment", count: 2, cents: -7_500, account: { code: "1200", name: "Patient receivables", side: "credit" } },
        { bucket: "patient_ar", kind: "write_off", label: "patient ar · Write-off", count: 1, cents: -20_000, account: null },
      ],
      entryCount: 3,
      totalCents: -27_500,
    },
    reasons: { rows: [{ code: "courtesy", kind: "write_off", label: "Write-off · courtesy", count: 1, cents: -20_000, withApproval: 1 }] },
    depositRegister: { rows: [{ method: "cash", status: "open", count: 1, cents: 25_000 }], count: 1, totalCents: 25_000 },
    mappings: { approved: 1, pending: 1, unmappedLines: 1, decidedAlone: 0 },
    sealedDays: {
      closesFrozen: 2,
      daysDisturbed: [{ businessDate: "2026-09-14", closes: 1, postings: 3, firstPostings: 1, cents: 1_000 }],
      postings: 3,
      firstPostings: 1,
      totalCents: 1_000,
    },
    counts: {
      period: { start: "2026-09-01", end: "2026-09-30", days: 30 },
      money: { postings: [{ key: "patient_payment", label: "Patient payment", count: 2, cents: -7_500 }], postingCount: 2, guardedWithSecond: 1, guardedWithoutSecond: 0 },
      approvals: { requested: 1, given: 1, declined: 0, cancelled: 0 },
      bank: { statementsImported: 1, runsCleared: 1, runsOwnerOnly: 1, variancesClearedWithReason: 0, depositsPrepared: 1, dayClosesFrozen: 1, postingsIntoSealedDays: 0, firstPostingsIntoSealedDays: 0, statementsIssued: 0, statementsHeld: 0, statementsVoided: 0 },
      findings: { opened: [], closed: [], openNow: 0 },
      decisions: { recorded: [{ key: "monitor", label: "Monitor", count: 1 }], reviews: { keep: 0, tighten: 0, retire: 0 }, overdueNow: 0, snapshotsFrozen: 1 },
      access: { signIns: 3, mfaEnrolled: 0, sessionsRevoked: 0, granted: 0, revoked: 0, policyChanges: 0 },
      alerts: { afterHoursHolds: 0, hardEventsAcknowledged: 1, channelsAttested: 0, releasesAttested: 0, releasesNeedingSecond: 0 },
      chain: { events: 12, firstSeq: 1, lastSeq: 12, acknowledgments: 0, otherKinds: [] },
      scope: SCOPE_SENTENCE,
    },
    controls: {
      coverage: [{ channel: "writeoff", label: "Write-offs / adjustments", enforcement: "enforced", status: "enforced", thresholdUsd: 150, activeExceptions: 1 }],
      activeExceptions: [{ id: "ex-after-hours-hold", label: "After-hours hold", action: "force_dual", channels: ["writeoff", "check"], effectiveTo: null }],
      decisions: { active: 1, overdueAtMonthEnd: 0, recordedInMonth: 1 },
      attestations: [{ channel: "payroll", count: 1, requiredSecond: 1 }],
      monthAttestations: [{ channel: "payroll", seat: "accountant", byName: "Casey Prentice", at: "2026-09-03T12:00:00.000Z" }],
    },
    chain: { headSeq: 12, headHash: "ab".repeat(32), eventsInMonth: 12, lastCheck: null },
    tieOut: [{ key: "journal_equals_postings", label: "Journal totals equal the month's ledger postings", holds: true, detail: "2 entries." }],
    scope: PACKAGE_SCOPE,
    ...over,
  };
}

describe("monthPeriod (Increment 1.34)", () => {
  it("covers the calendar month, first day to last, with an exclusive UTC end", () => {
    expect(monthPeriod("2026-09")).toMatchObject({ start: "2026-09-01", end: "2026-09-30", days: 30 });
    expect(monthPeriod("2028-02")).toMatchObject({ start: "2028-02-01", end: "2028-02-29", days: 29 });
    expect(monthPeriod("2026-12").endAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-9")).toBe(false);
    expect(() => monthPeriod("2026-13")).toThrow(/calendar month/);
  });
});

describe("packageHash and the flat rows", () => {
  it("is stable across key order and moves when a figure moves", () => {
    const a = pkg();
    // The keys reversed, derived rather than hand-listed: a package field added
    // later must keep this honest instead of quietly dropping out of the check.
    const reordered = JSON.parse(
      JSON.stringify(Object.fromEntries(Object.entries(a).reverse()))
    ) as MonthPackage;
    expect(Object.keys(reordered)).toEqual(Object.keys(a).reverse());
    expect(packageHash(reordered)).toBe(packageHash(a));
    expect(packageHash(pkg({ journal: { ...a.journal, totalCents: -7_600 } }))).not.toBe(packageHash(a));
  });

  it("covers what the package says about the month, and nothing it says about the practice right now (Increment 1.36)", () => {
    const a = pkg();
    const hash = packageHash(a);
    // The practice's position now: the chain head, the last nightly check, how many findings
    // are open, how many reviews are overdue, and how much of the chart of accounts is
    // approved or waiting. None of these is a figure about the month, so none moves the hash.
    expect(packageHash(pkg({ chain: { headSeq: 4_000, headHash: "cd".repeat(32), eventsInMonth: 12, lastCheck: { day: "2026-09-30", ok: true, checkedAt: "2026-09-30T06:00:00.000Z" } } }))).toBe(hash);
    expect(packageHash(pkg({ mappings: { approved: 9, pending: 4, unmappedLines: 1, decidedAlone: 0 } }))).toBe(hash);
    expect(packageHash(pkg({ counts: { ...a.counts, findings: { ...a.counts.findings, openNow: 7 } } }))).toBe(hash);
    expect(packageHash(pkg({ counts: { ...a.counts, decisions: { ...a.counts.decisions, overdueNow: 5 } } }))).toBe(hash);
    expect(
      packageHash(pkg({ tieOut: [{ key: "journal_equals_postings", label: "Journal totals equal the month's ledger postings", holds: true, detail: "2 entries, said another way." }] }))
    ).toBe(hash);

    // Figures about the month: how many of its lines went unmapped, how many chain events it
    // carried, what its controls were at month end, and whether a tie-out held.
    expect(packageHash(pkg({ mappings: { approved: 1, pending: 1, unmappedLines: 0, decidedAlone: 0 } }))).not.toBe(hash);
    // Increment 1.75: how many of the mappings this month's lines were read
    // through had one pair of hands on both ends is a figure about the month,
    // so the copy the accountant received still says it. `approved` and
    // `pending` stay outside the hash on the line above, because those are the
    // practice's position now and would move a frozen month's hash from a
    // later month's work.
    expect(packageHash(pkg({ mappings: { approved: 1, pending: 1, unmappedLines: 1, decidedAlone: 1 } }))).not.toBe(hash);
    expect(packageHash(pkg({ chain: { ...a.chain, eventsInMonth: 13 } }))).not.toBe(hash);
    expect(packageHash(pkg({ controls: { ...a.controls, activeExceptions: [] } }))).not.toBe(hash);
    expect(packageHash(pkg({ tieOut: [{ ...a.tieOut[0]!, holds: false }] }))).not.toBe(hash);
  });

  it("flattens every section into section, key, label, count, cents, and ends with the hash", () => {
    const a = pkg();
    const hash = packageHash(a);
    const rows = packageRows(a, hash);
    expect(rows[0]).toEqual({ section: "journal", key: "patient_ar|patient_payment", label: "patient ar · Patient payment → 1200 Patient receivables (credit)", count: 2, cents: -7_500 });
    expect(rows[1]).toMatchObject({ section: "journal", key: "patient_ar|write_off", label: "patient ar · Write-off → unmapped" });
    expect(rows.find((r) => r.key === "unmapped_journal_lines")).toMatchObject({ section: "mappings", count: 1 });
    expect(rows.find((r) => r.section === "reasons")?.label).toBe("Write-off · courtesy (with approval: 1)");
    expect(rows.find((r) => r.key === "after_hours_holds")).toMatchObject({ section: "alerts", count: 0 });
    expect(rows.find((r) => r.section === "tie_out")?.label).toMatch(/^Journal totals equal the month's ledger postings: yes\./);
    expect(rows.at(-1)).toEqual({ section: "meta", key: "package_hash", label: hash, count: "", cents: "" });
    const csv = toCsv(rows);
    expect(csv.split("\n")[0]).toBe("section,key,label,count,cents");
    expect(csv).toContain(`meta,package_hash,${hash},,`);
    expect(csv.trimEnd().split("\n")).toHaveLength(rows.length + 1);
  });

  it("names the shape it hashed, so two hashes are only ever compared within one version", () => {
    // The hash is self-describing: the version is inside it, so a package computed
    // under a different shape cannot silently produce a comparable-looking digest.
    expect(hashedView(pkg()).schema).toBe(PACKAGE_SCHEMA_VERSION);
    expect(PACKAGE_SCHEMA_VERSION).toBe("package-v8");
  });

  it("folds the whole digest into the hash, so a new digest field moves every frozen month", () => {
    // Discovered while building Increment 1.42: hashedView spreads pkg.counts, and
    // canonicalJson serializes every key, so adding one field to the weekly digest
    // changes the hash of months already closed. This pins the coupling, and it is
    // why a digest field is a package schema change: Increment 1.43 made the version
    // part of the hash and recorded it on the close, so a month closed under an
    // earlier shape reads as incomparable rather than as changed. Adding a digest
    // field means bumping PACKAGE_SCHEMA_VERSION in the same commit.
    const before = packageHash(pkg());
    const widened = pkg();
    (widened.counts.bank as unknown as Record<string, number>).aNewlyAddedCount = 0;
    expect(packageHash(widened)).not.toBe(before);
  });

  it("quotes a field holding a comma or a quote", () => {
    const csv = toCsv([{ section: "s", key: "k", label: 'Say "hi", then', count: 1, cents: "" }]);
    expect(csv.split("\n")[1]).toBe('s,k,"Say ""hi"", then",1,');
  });
});
