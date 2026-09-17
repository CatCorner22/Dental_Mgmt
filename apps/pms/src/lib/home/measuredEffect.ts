import { and, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { controlFindings, ledgerEntries, reconciliationRuns } from "@pms/db";
import type { AppDb } from "../db/client";
import { LEDGER_RELEASE_CHANNEL } from "../controls/detectors";

/**
 * What happened in the practice since a decision was made (docs/13 item 21:
 * "one deterministic sentence computed ... since the decision"). Counted
 * over the tenant's rows, never over a person: postings, guarded releases
 * with and without a second approver, bank runs cleared and how many of
 * them owner-only, detector findings opened and closed. The sentence is
 * labelled directional because the counts are small and uncalibrated; it is
 * shown so the owner reviews what happened rather than what they remember.
 */
export type MeasuredEffect = {
  /** YYYY-MM-DD the decision was made. */
  since: string;
  postings: number;
  guardedWithSecond: number;
  guardedWithoutSecond: number;
  runsCleared: number;
  runsOwnerOnly: number;
  findingsOpened: number;
  findingsClosed: number;
};

const GUARDED_KINDS = Object.keys(LEDGER_RELEASE_CHANNEL);

export async function measuredEffectSince(db: AppDb, tenantId: string, decidedAt: Date): Promise<MeasuredEffect> {
  const [postings] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, tenantId), gte(ledgerEntries.postedAt, decidedAt)));
  const [withSecond] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.tenantId, tenantId),
        gte(ledgerEntries.postedAt, decidedAt),
        inArray(ledgerEntries.kind, GUARDED_KINDS),
        isNotNull(ledgerEntries.approvalRequestId)
      )
    );
  const [withoutSecond] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.tenantId, tenantId),
        gte(ledgerEntries.postedAt, decidedAt),
        inArray(ledgerEntries.kind, GUARDED_KINDS),
        isNull(ledgerEntries.approvalRequestId)
      )
    );
  const runs = await db
    .select({ summary: reconciliationRuns.summary })
    .from(reconciliationRuns)
    .where(and(eq(reconciliationRuns.tenantId, tenantId), eq(reconciliationRuns.status, "cleared"), gte(reconciliationRuns.clearedAt, decidedAt)));
  const [opened] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(controlFindings)
    .where(and(eq(controlFindings.tenantId, tenantId), gte(controlFindings.firstSeenAt, decidedAt)));
  const [closed] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(controlFindings)
    .where(and(eq(controlFindings.tenantId, tenantId), gte(controlFindings.closedAt, decidedAt)));
  return {
    since: decidedAt.toISOString().slice(0, 10),
    postings: Number(postings?.n ?? 0),
    guardedWithSecond: Number(withSecond?.n ?? 0),
    guardedWithoutSecond: Number(withoutSecond?.n ?? 0),
    runsCleared: runs.length,
    runsOwnerOnly: runs.filter((r) => (r.summary as { degradedOwnerClearance?: boolean }).degradedOwnerClearance === true).length,
    findingsOpened: Number(opened?.n ?? 0),
    findingsClosed: Number(closed?.n ?? 0),
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One sentence, practice-wide, naming no one. */
export function measuredEffectSentence(e: MeasuredEffect): string {
  return (
    `Since this decision on ${e.since}: ${plural(e.postings, "posting", "postings")}; ` +
    `${plural(e.guardedWithSecond, "guarded release", "guarded releases")} with a second approver and ${e.guardedWithoutSecond} without; ` +
    `${plural(e.runsCleared, "bank run", "bank runs")} cleared, ${e.runsOwnerOnly} owner-only; ` +
    `${plural(e.findingsOpened, "detector finding", "detector findings")} opened, ${e.findingsClosed} closed. ` +
    `Directional and practice-wide; no one is named.`
  );
}
