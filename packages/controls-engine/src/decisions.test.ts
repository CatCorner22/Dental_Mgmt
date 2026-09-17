import { describe, expect, it } from "vitest";
import {
  activeDecisions,
  addDays,
  decisionCoverage,
  decisionPermitsGrant,
  FIRST_DECISION_KINDS,
  governingDecision,
  isIsoDate,
  latestDecisionFor,
  overdueReviews,
  reviewPlan,
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

describe("reviewing a decision (keep, tighten, retire)", () => {
  const prior: ControlDecision = {
    id: "dec-raise",
    subjectKind: "sod_finding",
    subjectId: "u-om:rule-vendor-create-pay",
    kind: "accept_residual",
    note: "Owner reviews the vendor ledger monthly and signs it.",
    reviewBy: "2026-09-20",
    decidedById: "u-owner",
    decidedByName: "Dr. Reagan",
    decidedAt: "2026-06-20T09:00:00.000Z",
  };

  it("keeps the kind and note for 90 days, tightens to remediate for 30 with a note, and retires with a note and no date", () => {
    expect(reviewPlan(prior, "keep", AS_OF)).toEqual({
      ok: true,
      plan: { kind: "accept_residual", note: prior.note, reviewBy: addDays(AS_OF, 90), supersedesDecisionId: "dec-raise" },
    });
    expect(reviewPlan(prior, "keep", AS_OF, "Still the right call; bookkeeper starts in January.")).toMatchObject({
      ok: true,
      plan: { note: "Still the right call; bookkeeper starts in January." },
    });
    expect(reviewPlan(prior, "tighten", AS_OF, "short")).toMatchObject({ ok: false });
    expect(reviewPlan(prior, "tighten", AS_OF, "Vendor creation moves to the owner from October.")).toEqual({
      ok: true,
      plan: { kind: "remediate", note: "Vendor creation moves to the owner from October.", reviewBy: addDays(AS_OF, 30), supersedesDecisionId: "dec-raise" },
    });
    expect(reviewPlan(prior, "retire", AS_OF, "")).toMatchObject({ ok: false });
    expect(reviewPlan(prior, "retire", AS_OF, "The office manager no longer pays vendors.")).toEqual({
      ok: true,
      plan: { kind: "retire", note: "The office manager no longer pays vendors.", supersedesDecisionId: "dec-raise" },
    });
    expect(reviewPlan({ ...prior, kind: "retire" }, "keep", AS_OF)).toMatchObject({ ok: false });
  });

  it("reads a retired subject as undecided, and refuses a retire row with a review date", () => {
    const retired: ControlDecision = {
      ...prior,
      id: "dec-retire",
      kind: "retire",
      note: "The office manager no longer pays vendors.",
      reviewBy: undefined,
      decidedAt: "2026-09-15T09:00:00.000Z",
      supersedesDecisionId: "dec-raise",
    };
    expect(activeDecisions([prior, retired]).map((d) => d.id)).toEqual(["dec-retire"]);
    expect(latestDecisionFor([prior, retired], "sod_finding", prior.subjectId)).toBeUndefined();
    expect(latestDecisionFor([prior], "sod_finding", prior.subjectId)?.id).toBe("dec-raise");
    expect(overdueReviews([prior, retired], AS_OF)).toEqual([]);
    expect(validateDecision({ kind: "retire", note: retired.note, reviewBy: "2026-12-01" }, AS_OF).errors[0]).toMatch(/no review date/);
    expect(validateDecision({ kind: "retire", note: retired.note }, AS_OF).ok).toBe(true);
    expect(FIRST_DECISION_KINDS).not.toContain("retire");
  });
});
