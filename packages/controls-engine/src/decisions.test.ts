import { describe, expect, it } from "vitest";
import {
  activeDecisions,
  addDays,
  decisionCoverage,
  decisionPermitsGrant,
  governingDecision,
  isIsoDate,
  latestDecisionFor,
  overdueReviews,
  validateDecision,
  type ControlDecision,
} from "./decisions";
import { AS_OF, liveDecisions } from "./fixtures/live-grants";
import type { DetectedConflict } from "./sod/detect";

const note = "Owner reviews the exception report monthly and signs it.";

describe("validateDecision", () => {
  it("accepts a well-formed decision", () => {
    expect(validateDecision({ kind: "monitor", note, reviewBy: "2026-12-01" }, AS_OF)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("refuses an unknown kind, a bare note, and a review date that is past or too far", () => {
    expect(validateDecision({ kind: "ignore", note }, AS_OF).errors[0]).toMatch(/kind/);
    expect(validateDecision({ kind: "monitor", note: "ok" }, AS_OF).errors[0]).toMatch(/note/);
    expect(validateDecision({ kind: "monitor", note, reviewBy: AS_OF }, AS_OF).errors[0]).toMatch(
      /after today/,
    );
    expect(
      validateDecision({ kind: "monitor", note, reviewBy: addDays(AS_OF, 366) }, AS_OF).errors[0],
    ).toMatch(/within 365 days/);
    expect(validateDecision({ kind: "monitor", note, reviewBy: "soon" }, AS_OF).errors[0]).toMatch(
      /ISO date/,
    );
  });

  it("refuses a calendar-invalid date that Date.parse would roll forward", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(validateDecision({ kind: "monitor", note, reviewBy: "2026-11-31" }, AS_OF).errors[0]).toMatch(/ISO date/);
  });
});

describe("decisionPermitsGrant", () => {
  it("requires accept_residual or compensate with a review date", () => {
    expect(decisionPermitsGrant({ kind: "accept_residual", note, reviewBy: "2026-12-01" }, AS_OF).ok).toBe(
      true,
    );
    expect(decisionPermitsGrant({ kind: "compensate", note, reviewBy: "2026-12-01" }, AS_OF).ok).toBe(true);
    expect(decisionPermitsGrant({ kind: "monitor", note, reviewBy: "2026-12-01" }, AS_OF).ok).toBe(false);
    expect(decisionPermitsGrant({ kind: "accept_residual", note }, AS_OF).errors).toContain(
      "A grant decision must carry a review date.",
    );
  });
});

describe("decision register helpers", () => {
  const superseding: ControlDecision = {
    id: "dec-3",
    subjectKind: "sod_finding",
    subjectId: "u-bill:rule-writeoff",
    kind: "remediate",
    note: "Move approve_writeoffs off billing; owner approves above $150 from October.",
    reviewBy: "2026-11-01",
    decidedById: "u-owner",
    decidedByName: "Dr. Reagan",
    decidedAt: "2026-09-10T09:00:00.000Z",
    supersedesDecisionId: "dec-2",
  };

  it("drops superseded decisions and finds the latest per subject", () => {
    const all = [...liveDecisions, superseding];
    expect(activeDecisions(all).map((d) => d.id)).toEqual(["dec-1", "dec-3"]);
    expect(latestDecisionFor(all, "sod_finding", "u-bill:rule-writeoff")?.id).toBe("dec-3");
    expect(latestDecisionFor(liveDecisions, "sod_finding", "u-bill:rule-writeoff")?.id).toBe("dec-2");
  });

  it("lists overdue reviews", () => {
    expect(overdueReviews(liveDecisions, AS_OF).map((d) => d.id)).toEqual(["dec-2"]);
    expect(overdueReviews([...liveDecisions, superseding], AS_OF)).toEqual([]);
  });

  it("splits conflicts into open, decided, and overdue", () => {
    const conflict = (id: string): DetectedConflict =>
      ({ id, ruleId: id.split(":")[1], personId: id.split(":")[0] }) as DetectedConflict;
    const conflicts = [
      conflict("u-om:rule-vendor-create-pay"),
      conflict("u-bill:rule-writeoff"),
      conflict("u-front:rule-collect-post"),
    ];
    const cover = decisionCoverage(conflicts, liveDecisions, AS_OF);
    expect(cover.decided.map((d) => d.conflict.id)).toEqual(["u-om:rule-vendor-create-pay"]);
    expect(cover.overdue.map((d) => d.conflict.id)).toEqual(["u-bill:rule-writeoff"]);
    expect(cover.open.map((c) => c.id)).toEqual(["u-front:rule-collect-post"]);
    expect(cover.coveragePct).toBe(33);
    expect(decisionCoverage([], liveDecisions, AS_OF).coveragePct).toBe(100);
  });

  it("lets a decision on the control govern every conflict of that control", () => {
    const conflict = (id: string): DetectedConflict =>
      ({ id, ruleId: id.split(":")[1], personId: id.split(":")[0] }) as DetectedConflict;
    const controlWide: ControlDecision = {
      id: "dec-cash",
      subjectKind: "control",
      subjectId: "c-sod-cash",
      kind: "accept_residual",
      note: "Owner reconciles the bank personally every Friday.",
      reviewBy: "2026-12-01",
      decidedById: "u-owner",
      decidedByName: "Dr. Reagan",
      decidedAt: "2026-09-02T00:00:00.000Z",
    };
    const conflicts = [conflict("u-om:rule-deposit-post"), conflict("u-front:rule-deposit-post"), conflict("u-front:rule-collect-post")];
    expect(governingDecision(conflicts[0], [controlWide])?.id).toBe("dec-cash");
    expect(governingDecision(conflicts[2], [controlWide])).toBeUndefined(); // c-cash, not c-sod-cash
    const cover = decisionCoverage(conflicts, [controlWide], AS_OF);
    expect(cover.decided.map((d) => d.conflict.id)).toEqual(["u-om:rule-deposit-post", "u-front:rule-deposit-post"]);
    expect(cover.open.map((c) => c.id)).toEqual(["u-front:rule-collect-post"]);
    // A decision on the finding itself wins over the control-wide one.
    const own: ControlDecision = { ...controlWide, id: "dec-own", subjectKind: "sod_finding", subjectId: "u-om:rule-deposit-post", kind: "remediate" };
    expect(governingDecision(conflicts[0], [controlWide, own])?.id).toBe("dec-own");
  });
});
