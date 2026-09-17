import { and, eq } from "drizzle-orm";
import { locations } from "@pms/db";
import {
  activeDecisions,
  DECISION_KIND_LABEL,
  type ControlDecision,
  type ControlSnapshot,
  type MatchingMeasurementSummary,
  type ReconciliationMeasurementSummary,
  type ThresholdException,
} from "@pms/controls-engine";
import type { AppDb } from "../db/client";
import { listInboxApprovals } from "../controls/approvals";
import { matchingSummary } from "../controls/matchingMeasure";
import { measurementSummary } from "../controls/reconciliationMeasure";
import { computeSnapshot } from "../controls/snapshots";
import { getDayCloseSnapshot } from "../day-close/service";
import { listReconciliationRuns } from "../reconciliation/queries";

/**
 * The owner's home board (docs/04, Owner row; docs/13 items 15 and 21),
 * computed server-side from live rows on every read. Nothing here scores
 * and nothing here ranks a person: copy describes hands and process.
 *
 * "Yesterday reconciled?" is one shape and a few words, readable in
 * grayscale. No green state exists without a bank line the practice
 * imported: a day sheet alone is a self-assertion.
 */

export type TileShape = "filled" | "half" | "triangle";

export type YesterdayTile = {
  businessDate: string;
  shape: TileShape;
  headline: string;
  why: string;
  action: { label: string; href: string } | null;
};

export type RunForBoard = {
  runId: string;
  source: string;
  status: string;
  openVarianceCount: number;
  /** ISO timestamp. */
  createdAt: string;
};

export type CloseForBoard = {
  locationName: string;
  status: "open" | "frozen";
  depositCount: number;
  depositTotalCents: number;
  daySheetTotalCents: number;
};

const BANK_SOURCES = new Set(["statement_import", "aggregator_feed"]);

export function dayBefore(asOf: string): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function daysAfter(asOf: string, days: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function yesterdayTile(input: {
  asOf: string;
  closes: CloseForBoard[];
  runs: RunForBoard[];
  reconciliation: ReconciliationMeasurementSummary;
}): YesterdayTile {
  const businessDate = dayBefore(input.asOf);
  const bankRuns = input.runs.filter((r) => BANK_SOURCES.has(r.source));

  if (bankRuns.length === 0) {
    return {
      businessDate,
      shape: "triangle",
      headline: "No bank record yet",
      why: "No bank statement has been imported, so nothing here is tied to the bank. A day sheet on its own is a self-assertion.",
      action: { label: "Import a statement", href: "/reconciliation" },
    };
  }

  const withOpen = bankRuns
    .filter((r) => r.openVarianceCount > 0)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const openVariances = withOpen.reduce((n, r) => n + r.openVarianceCount, 0);
  if (openVariances > 0) {
    return {
      businessDate,
      shape: "triangle",
      headline: `${openVariances} variance${openVariances === 1 ? "" : "s"}`,
      why: `${openVariances} bank line${openVariances === 1 ? " has" : "s have"} no matching deposit and no clearance yet, across ${withOpen.length} run${withOpen.length === 1 ? "" : "s"}.`,
      action: { label: "Open the variance queue", href: `/reconciliation/${withOpen[0]!.runId}` },
    };
  }

  const unclosed = input.closes.filter(
    (c) => c.status === "open" && (c.depositCount > 0 || c.daySheetTotalCents !== 0 || c.depositTotalCents !== 0)
  );
  if (unclosed.length > 0) {
    const names = unclosed.map((c) => c.locationName).join(", ");
    return {
      businessDate,
      shape: "half",
      headline: "Yesterday not closed",
      why: `Deposits or collections were recorded for ${businessDate} at ${names} and the day is not frozen, so no second count has happened.`,
      action: { label: "Close the day", href: "/day-close" },
    };
  }

  switch (input.reconciliation.grade) {
    case "independent":
      return {
        businessDate,
        shape: "filled",
        headline: "Tied · independent",
        why: input.reconciliation.why,
        action: null,
      };
    case "same_hands":
      return {
        businessDate,
        shape: "half",
        headline: "Tied · needs a second look",
        why: `The same hands posted or prepared deposits and cleared the bank reconciliation. ${input.reconciliation.why}`,
        action: { label: "See who can clear independently", href: "/risk" },
      };
    default:
      return {
        businessDate,
        shape: "half",
        headline: "Tied · last clearance is stale",
        why: input.reconciliation.why,
        action: { label: "Import a statement", href: "/reconciliation" },
      };
  }
}

export type DecisionDue = {
  id: string;
  subjectKind: string;
  subjectId: string;
  kind: string;
  kindLabel: string;
  reviewBy: string;
  overdue: boolean;
  note: string;
  decidedByName: string;
};

/** Active decisions whose review date has passed or falls within the horizon; overdue first. */
export function decisionsDue(decisions: ControlDecision[], asOf: string, horizonDays = 30): DecisionDue[] {
  const horizon = daysAfter(asOf, horizonDays);
  return activeDecisions(decisions)
    .filter((d): d is ControlDecision & { reviewBy: string } => d.reviewBy != null && d.reviewBy <= horizon)
    .map((d) => ({
      id: d.id,
      subjectKind: d.subjectKind,
      subjectId: d.subjectId,
      kind: d.kind,
      kindLabel: DECISION_KIND_LABEL[d.kind],
      reviewBy: d.reviewBy,
      overdue: d.reviewBy < asOf,
      note: d.note,
      decidedByName: d.decidedByName,
    }))
    .sort((a, b) => (a.overdue === b.overdue ? (a.reviewBy < b.reviewBy ? -1 : 1) : a.overdue ? -1 : 1));
}

export type ExpiringException = {
  id: string;
  label: string;
  action: string;
  effectiveTo: string;
  daysLeft: number;
};

/** Enabled exceptions whose window ends within the horizon (today included); soonest first. */
export function expiringExceptions(exceptions: ThresholdException[], asOf: string, horizonDays = 14): ExpiringException[] {
  const horizon = daysAfter(asOf, horizonDays);
  return exceptions
    .filter((e): e is ThresholdException & { effectiveTo: string } => e.enabled && e.effectiveTo != null && e.effectiveTo >= asOf && e.effectiveTo <= horizon)
    .map((e) => ({
      id: e.id,
      label: e.label,
      action: e.action,
      effectiveTo: e.effectiveTo,
      daysLeft: Math.round((Date.parse(`${e.effectiveTo}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export type HealthCard = {
  segregationHealth: number;
  cosoOverall: number;
  openConflicts: number;
  conflictsWithoutDecision: number;
  unmitigatedCritical: number;
  /** The three levers that would lower average residual most, from the tornado. */
  levers: { id: string; label: string; delta: number }[];
};

export function healthCard(snapshot: ControlSnapshot, leverCount = 3): HealthCard {
  const levers = (snapshot.tornado.levers ?? [])
    .filter((l) => l.delta > 0)
    .slice(0, leverCount)
    .map((l) => ({ id: l.id, label: l.label, delta: Math.round(l.delta * 10) / 10 }));
  return {
    segregationHealth: snapshot.headline.segregationHealth,
    cosoOverall: snapshot.headline.cosoOverall,
    openConflicts: snapshot.headline.openConflicts,
    conflictsWithoutDecision: snapshot.headline.conflictsWithoutDecision,
    unmitigatedCritical: snapshot.headline.unmitigatedCritical,
    levers,
  };
}

export type OwnerBoard = {
  asOf: string;
  computedAt: string;
  yesterday: YesterdayTile;
  approvals: { waiting: number; totalCents: number };
  decisionsDue: DecisionDue[];
  expiringExceptions: ExpiringException[];
  health: HealthCard;
  reconciliation: ReconciliationMeasurementSummary;
  matching: MatchingMeasurementSummary;
};

/**
 * Everything the board shows, from live rows in one transaction: the
 * snapshot (which measures reconciliation and matching on the way), the
 * runs, yesterday's close at every active location, the viewer's inbox,
 * the register, and the active policy's exceptions.
 */
export async function buildOwnerBoard(db: AppDb, tenantId: string, viewerId: string, now: Date = new Date()): Promise<OwnerBoard> {
  const asOf = now.toISOString().slice(0, 10);
  const { ctx, snapshot } = await computeSnapshot(db, tenantId, now);

  const runs = (await listReconciliationRuns(db, tenantId)).map<RunForBoard>((r) => ({
    runId: r.runId,
    source: r.source,
    status: r.status,
    openVarianceCount: r.openVarianceCount,
    createdAt: r.createdAt,
  }));

  const yesterday = dayBefore(asOf);
  const sites = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.active, true)));
  const closes: CloseForBoard[] = [];
  for (const site of sites) {
    const s = await getDayCloseSnapshot(db, tenantId, site.id, yesterday);
    closes.push({
      locationName: site.name,
      status: s.status,
      depositCount: s.deposits.length,
      depositTotalCents: s.depositTotalCents,
      daySheetTotalCents: s.daySheetTotalCents,
    });
  }

  const inbox = (await listInboxApprovals(db, tenantId, viewerId)).filter((r) => r.status === "pending");

  return {
    asOf,
    computedAt: now.toISOString(),
    yesterday: yesterdayTile({ asOf, closes, runs, reconciliation: measurementSummary(ctx.reconciliation) }),
    approvals: { waiting: inbox.length, totalCents: inbox.reduce((n, r) => n + Number(r.amountCents), 0) },
    decisionsDue: decisionsDue(ctx.decisions, asOf),
    expiringExceptions: expiringExceptions(ctx.active?.policy.exceptions ?? [], asOf),
    health: healthCard(snapshot),
    reconciliation: measurementSummary(ctx.reconciliation),
    matching: matchingSummary(ctx.matching),
  };
}
