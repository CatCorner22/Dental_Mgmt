import { and, eq, gte, sql } from "drizzle-orm";
import { bankAccounts, reconciliationRuns } from "@pms/db";
import type { ReconciliationMeasurementSummary } from "@pms/controls-engine";
import type { AppDb } from "../db/client";
import { listDepositsForRunPeriod, listPaymentPosterIds } from "../reconciliation/clear";

/**
 * Independent bank reconciliation, measured rather than assumed.
 *
 * docs/05: "reconciliation_runs.independent is computed (the closer held no
 * custody or recording activity that day)", graded independent | same_hands
 * | stale_import, and fed to the residual engine as measured operating
 * effectiveness. A run counts when it is cleared from a bank source
 * (statement import or aggregator feed) inside the window. Its clearer held
 * custody or recording for the period when they prepared a deposit in it or
 * posted a patient payment in it, which is the same test variance clearance
 * applies at the moment of clearing. The grade is strict: every cleared run
 * in the window must be independent for the practice to count as
 * independent, because one same-hands clearance means the control did not
 * operate independently throughout.
 */
export const RECONCILIATION_WINDOW_DAYS = 45;

export type ReconciliationGrade = "independent" | "same_hands" | "stale_import";

export type RunFacts = {
  runId: string;
  source: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  /** ISO timestamp. */
  clearedAt: string | null;
  clearedById: string | null;
  clearedByName: string | null;
  degradedOwnerClearance: boolean;
  /** The clearer prepared a deposit or posted a payment inside the run's period. */
  clearerHeldCustodyOrRecording: boolean;
};

export type ReconciliationMeasurement = ReconciliationMeasurementSummary & {
  asOf: string;
  independentBankRec: boolean;
  independentInWindow: number;
  latest: {
    runId: string;
    clearedAt: string;
    clearedByName: string | null;
    periodStart: string;
    periodEnd: string;
    grade: Exclude<ReconciliationGrade, "stale_import">;
  } | null;
};

const BANK_SOURCES = new Set(["statement_import", "aggregator_feed"]);

export function windowStartFor(asOf: string, windowDays: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - windowDays);
  return d.toISOString().slice(0, 10);
}

export function gradeRun(run: RunFacts): Exclude<ReconciliationGrade, "stale_import"> {
  return run.degradedOwnerClearance || run.clearerHeldCustodyOrRecording ? "same_hands" : "independent";
}

export function gradeReconciliation(
  runs: RunFacts[],
  asOf: string,
  windowDays: number = RECONCILIATION_WINDOW_DAYS
): ReconciliationMeasurement {
  const windowStart = windowStartFor(asOf, windowDays);
  const cleared = runs
    .filter(
      (r) =>
        r.status === "cleared" &&
        r.clearedAt != null &&
        BANK_SOURCES.has(r.source) &&
        r.clearedAt.slice(0, 10) >= windowStart &&
        r.clearedAt.slice(0, 10) <= asOf
    )
    .sort((a, b) => (a.clearedAt! < b.clearedAt! ? 1 : -1));

  const base = { asOf, windowDays, clearedInWindow: cleared.length };
  if (cleared.length === 0) {
    return {
      ...base,
      grade: "stale_import",
      independentBankRec: false,
      independentInWindow: 0,
      sameHandsInWindow: 0,
      latestClearedAt: null,
      latest: null,
      why: `No reconciliation run cleared from a bank statement in the last ${windowDays} days.`,
    };
  }

  const graded = cleared.map((r) => ({ run: r, grade: gradeRun(r) }));
  const sameHands = graded.filter((g) => g.grade === "same_hands");
  const latestRun = graded[0]!;
  const latest = {
    runId: latestRun.run.runId,
    clearedAt: latestRun.run.clearedAt!,
    clearedByName: latestRun.run.clearedByName,
    periodStart: latestRun.run.periodStart,
    periodEnd: latestRun.run.periodEnd,
    grade: latestRun.grade,
  };
  if (sameHands.length > 0) {
    const s = sameHands.length === 1 ? "" : "s";
    return {
      ...base,
      grade: "same_hands",
      independentBankRec: false,
      independentInWindow: graded.length - sameHands.length,
      sameHandsInWindow: sameHands.length,
      latestClearedAt: latest.clearedAt,
      latest,
      why: `${sameHands.length} of ${graded.length} run${graded.length === 1 ? "" : "s"} cleared in the last ${windowDays} days ${s ? "were" : "was"} cleared by someone who prepared deposits or posted payments in the period${
        sameHands.some((g) => g.run.degradedOwnerClearance) ? ", including owner-only clearance recorded as a finding" : ""
      }.`,
    };
  }
  return {
    ...base,
    grade: "independent",
    independentBankRec: true,
    independentInWindow: graded.length,
    sameHandsInWindow: 0,
    latestClearedAt: latest.clearedAt,
    latest,
    why: `${graded.length} run${graded.length === 1 ? "" : "s"} cleared from a bank statement in the last ${windowDays} days, each by someone who neither prepared deposits nor posted payments in the period.`,
  };
}

/** The engine-facing summary: what the snapshot freezes. */
export function measurementSummary(m: ReconciliationMeasurement): ReconciliationMeasurementSummary {
  return {
    grade: m.grade,
    windowDays: m.windowDays,
    clearedInWindow: m.clearedInWindow,
    sameHandsInWindow: m.sameHandsInWindow,
    latestClearedAt: m.latestClearedAt,
    why: m.why,
  };
}

/**
 * Reads the cleared runs in the window and decides, per run, whether the
 * clearer held custody or recording for the period. Queries run in sequence
 * on the one transaction client.
 */
export async function measureReconciliation(
  db: AppDb,
  tenantId: string,
  now: Date = new Date(),
  windowDays: number = RECONCILIATION_WINDOW_DAYS
): Promise<ReconciliationMeasurement> {
  const asOf = now.toISOString().slice(0, 10);
  const since = new Date(`${windowStartFor(asOf, windowDays)}T00:00:00Z`);
  const rows = await db
    .select({
      runId: reconciliationRuns.id,
      bankAccountId: reconciliationRuns.bankAccountId,
      locationId: bankAccounts.locationId,
      source: reconciliationRuns.source,
      status: reconciliationRuns.status,
      periodStart: reconciliationRuns.periodStart,
      periodEnd: reconciliationRuns.periodEnd,
      clearedAt: reconciliationRuns.clearedAt,
      clearedById: reconciliationRuns.clearedById,
      clearedByName: reconciliationRuns.clearedByName,
      summary: reconciliationRuns.summary,
    })
    .from(reconciliationRuns)
    .innerJoin(bankAccounts, eq(bankAccounts.id, reconciliationRuns.bankAccountId))
    .where(
      and(
        eq(reconciliationRuns.tenantId, tenantId),
        eq(reconciliationRuns.status, "cleared"),
        gte(reconciliationRuns.clearedAt, since)
      )
    )
    .orderBy(sql`${reconciliationRuns.clearedAt} desc`);

  const facts: RunFacts[] = [];
  for (const row of rows) {
    const periodStart = String(row.periodStart);
    const periodEnd = String(row.periodEnd);
    let held = false;
    if (row.clearedById) {
      const prepared = await listDepositsForRunPeriod(db, {
        tenantId,
        bankAccountId: row.bankAccountId,
        periodStart,
        periodEnd,
      });
      if (prepared.some((d) => d.preparedById === row.clearedById)) held = true;
      if (!held) {
        const posters = await listPaymentPosterIds(db, {
          tenantId,
          periodStart,
          periodEnd,
          locationId: row.locationId ?? null,
        });
        if (posters.includes(row.clearedById)) held = true;
      }
    }
    const summary = (row.summary ?? {}) as Record<string, unknown>;
    facts.push({
      runId: row.runId,
      source: row.source,
      status: row.status,
      periodStart,
      periodEnd,
      clearedAt: row.clearedAt?.toISOString() ?? null,
      clearedById: row.clearedById,
      clearedByName: row.clearedByName,
      degradedOwnerClearance: summary.degradedOwnerClearance === true,
      clearerHeldCustodyOrRecording: held,
    });
  }
  return gradeReconciliation(facts, asOf, windowDays);
}
