import { describe, expect, it } from "vitest";
import { canonicalJson, digestHash, eventLabel, periodEnding, SCOPE_SENTENCE, type WeeklyDigest } from "./digest";

function digest(over: Partial<WeeklyDigest> = {}): WeeklyDigest {
  return {
    period: { start: "2026-09-11", end: "2026-09-17", days: 7 },
    money: { postings: [{ key: "patient_payment", label: "Patient payment", count: 3, cents: 12_000 }], postingCount: 3, guardedWithSecond: 1, guardedWithoutSecond: 0 },
    approvals: { requested: 1, given: 1, declined: 1, cancelled: 0 },
    bank: {
      statementsImported: 1,
      runsCleared: 1,
      runsOwnerOnly: 1,
      variancesClearedWithReason: 1,
      depositsPrepared: 0,
      dayClosesFrozen: 1,
      postingsIntoSealedDays: 0,
      firstPostingsIntoSealedDays: 0,
      statementsIssued: 1,
      statementsHeld: 0,
      statementsVoided: 0,
    },
    findings: { opened: [{ key: "unmatched_bank_line_48h", label: "Unmatched bank line older than 48 hours", count: 1 }], closed: [], openNow: 1 },
    decisions: { recorded: [], reviews: { keep: 0, tighten: 0, retire: 0 }, overdueNow: 0, snapshotsFrozen: 1 },
    access: { signIns: 4, mfaEnrolled: 0, sessionsRevoked: 0, granted: 2, revoked: 1, policyChanges: 0 },
    alerts: { afterHoursHolds: 0, hardEventsAcknowledged: 0 },
    chain: { events: 14, firstSeq: 3, lastSeq: 16, acknowledgments: 0, otherKinds: [] },
    scope: SCOPE_SENTENCE,
    ...over,
  };
}

describe("periodEnding", () => {
  it("covers the seven calendar days ending on the date, inclusive, with an exclusive UTC end", () => {
    const p = periodEnding("2026-09-17");
    expect(p).toMatchObject({ start: "2026-09-11", end: "2026-09-17", days: 7 });
    expect(p.startAt.toISOString()).toBe("2026-09-11T00:00:00.000Z");
    expect(p.endAt.toISOString()).toBe("2026-09-18T00:00:00.000Z");
    expect(periodEnding("2026-03-03").start).toBe("2026-02-25");
    expect(() => periodEnding("2026-02-30")).toThrow(/calendar date/);
  });
});

describe("digestHash", () => {
  it("is stable across key order and changes when any count changes", () => {
    const a = digest();
    const reordered = JSON.parse(JSON.stringify({ scope: a.scope, chain: a.chain, alerts: a.alerts, access: a.access, decisions: a.decisions, findings: a.findings, bank: a.bank, approvals: a.approvals, money: a.money, period: a.period })) as WeeklyDigest;
    expect(digestHash(reordered)).toBe(digestHash(a));
    expect(digestHash(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(digestHash(digest({ chain: { ...a.chain, events: 15 } }))).not.toBe(digestHash(a));
    expect(canonicalJson({ b: [2, { d: 1, c: 2 }], a: null })).toBe('{"a":null,"b":[2,{"c":2,"d":1}]}');
  });
});

describe("eventLabel", () => {
  it("names the kinds it knows and reads the rest as plain words", () => {
    expect(eventLabel("reconciliation.cleared")).toBe("Bank run cleared");
    expect(eventLabel("something.new_here")).toBe("something new here");
  });
});
