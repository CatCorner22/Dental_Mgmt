import { and, eq, sql } from "drizzle-orm";
import { ledgerEntries, monthCloses, uuidv7 } from "@pms/db";
import { evaluateRelease } from "@pms/controls-engine";
import { CHANNEL_BY_KIND } from "@pms/ledger";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { loadActivePolicy } from "../controls/policy";
import { loadStaff } from "../controls/staff";
import { PRIOR_PERIOD_REASON } from "../cpa/close";
import { afterHoursFactsFor, glBucketForKind } from "./post";

/**
 * Correcting a posted entry (docs/13 feature 20 and item 22; Increment 1.37).
 *
 * There is no correction kind. A correction is two rows written in one
 * transaction: a reversal mirroring the entry it clears, and a repost of the
 * original's kind carrying the corrected figure. Both name the entry they
 * correct, both carry the same reason code, and both post today against the
 * original's effective date, so the ledger reads as the practice's history
 * rather than as a rewrite of it.
 *
 * Where the original falls in a month the practice has closed, both rows
 * carry reason `prior_period`, which is the only reason the closed-month
 * refusal admits, and only alongside the link that proves the pair. The
 * caller's own reason is recorded in each row's memo, so the why survives.
 */

export type CorrectionRefusal = {
  ok: false;
  code:
    | "entry_not_found"
    | "correct_a_reversal"
    | "already_reversed"
    | "unchanged"
    | "missing_reason"
    | "no_policy"
    | "needs_second";
  verb: string;
  control: string;
  why: string;
};

export type CorrectionSuccess = {
  ok: true;
  reversalId: string;
  repostId: string;
  /** The reason code both rows carry: the caller's, or `prior_period` into a closed month. */
  reasonCode: string;
  closedMonth: string | null;
};

export type CorrectionResult = CorrectionSuccess | CorrectionRefusal;

export type CorrectEntryInput = {
  tenantId: string;
  actorId: string;
  actorName: string;
  entryId: string;
  /** The figure the entry should have carried, in the original's sign convention. */
  amountCents: number;
  /** Why it is being corrected; recorded on both rows, or in their memo inside a closed month. */
  reasonCode: string;
  memo?: string | null;
  now?: Date;
};

/** The month close covering a date, or null when the date is in an open month. */
export async function closedMonthFor(db: AppDb, tenantId: string, effectiveDate: string): Promise<string | null> {
  const rows = await db
    .select({ month: monthCloses.month })
    .from(monthCloses)
    .where(
      and(
        eq(monthCloses.tenantId, tenantId),
        sql`${effectiveDate}::date BETWEEN ${monthCloses.periodStart} AND ${monthCloses.periodEnd}`
      )
    )
    .limit(1);
  return rows[0]?.month ?? null;
}

/**
 * Writes the reversal-and-repost pair for one entry.
 *
 * Refuses an entry this practice does not hold, a reversal (correct the row it
 * reverses instead), an entry already reversed (correct its repost instead),
 * and a correction that changes nothing. A correction whose amount needs a
 * second person under the dual-release policy is refused rather than held: the
 * pair has to land in one transaction, and a hold would split it. The database
 * refuses it too, on the same policy, whatever this service decides.
 */
export async function correctEntry(db: AppDb, input: CorrectEntryInput): Promise<CorrectionResult> {
  const now = input.now ?? new Date();
  if (!input.reasonCode.trim()) {
    return {
      ok: false,
      code: "missing_reason",
      verb: "Select a reason",
      control: "Reason code",
      why: "A correction records why the figure changed; both rows carry the reason.",
    };
  }

  const [original] = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, input.tenantId), eq(ledgerEntries.id, input.entryId)))
    .limit(1);

  if (!original) {
    return {
      ok: false,
      code: "entry_not_found",
      verb: "Choose an entry",
      control: "Ledger",
      why: "This practice holds no such entry.",
    };
  }

  if (original.kind === "reversal") {
    return {
      ok: false,
      code: "correct_a_reversal",
      verb: "Correct the original",
      control: "Ledger",
      why: "This row is itself a reversal. Correct the entry it reverses, or the repost written with it.",
    };
  }

  const [{ reversals }] = await db
    .select({ reversals: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.tenantId, input.tenantId),
        eq(ledgerEntries.kind, "reversal"),
        eq(ledgerEntries.reversesEntryId, original.id)
      )
    );
  if (Number(reversals) > 0) {
    return {
      ok: false,
      code: "already_reversed",
      verb: "Correct the repost",
      control: "Ledger",
      why: "This entry was corrected once already. Correct the repost that replaced it, so the chain of corrections stays readable.",
    };
  }

  if (input.amountCents === original.amountCents) {
    return {
      ok: false,
      code: "unchanged",
      verb: "Change the figure",
      control: "Ledger",
      why: "The corrected figure matches the entry. A correction that changes nothing writes two rows and says nothing.",
    };
  }

  const effectiveDate = String(original.effectiveDate).slice(0, 10);
  const closedMonth = await closedMonthFor(db, input.tenantId, effectiveDate);
  const reasonCode = closedMonth ? PRIOR_PERIOD_REASON : input.reasonCode.trim();

  // The reversal carries the larger exposure of the two rows in the general case,
  // but the practice is releasing both, so the policy reads the larger amount.
  const releaseCents = Math.max(Math.abs(original.amountCents), Math.abs(input.amountCents));
  const active = await loadActivePolicy(db, input.tenantId);
  if (!active) {
    return {
      ok: false,
      code: "no_policy",
      verb: "Cannot correct",
      control: "Controls",
      why: "No control policy configured for this practice.",
    };
  }
  const { people } = await loadStaff(db, input.tenantId, now);
  const afterHours = await afterHoursFactsFor(db, input.tenantId, original.locationId, now);
  const evaluation = evaluateRelease(
    active.policy,
    {
      channel: CHANNEL_BY_KIND.reversal!,
      amountUsd: releaseCents / 100,
      initiatorPersonId: input.actorId,
      memo: input.memo ?? undefined,
      outsideBusinessHours: afterHours != null,
    },
    people
  );
  if (!evaluation.ok || evaluation.dualRequired) {
    return {
      ok: false,
      code: "needs_second",
      verb: "Post the correction the ordinary way",
      control: evaluation.eligibleSeconds[0]?.name ?? "Controls",
      why: `A correction of this size needs a second person, and a pair has to land in one transaction. ${
        evaluation.reasons[0] ?? "Two people must release this amount."
      }`,
    };
  }

  const appliedExceptionId = evaluation.appliedException ? evaluation.appliedException.id : null;
  const why = closedMonth
    ? `Corrects entry ${original.id} (${input.reasonCode.trim()}); ${closedMonth} is closed to the accountant.`
    : `Corrects entry ${original.id} (${input.reasonCode.trim()}).`;
  const memo = input.memo?.trim() ? `${why} ${input.memo.trim()}` : why;

  const reversalId = uuidv7(now.getTime());
  const repostId = uuidv7(now.getTime() + 1);
  const shared = {
    tenantId: input.tenantId,
    accountId: original.accountId,
    patientId: original.patientId,
    locationId: original.locationId,
    glBucket: glBucketForKind("adjustment"),
    currency: original.currency,
    reasonCode,
    effectiveDate,
    postedAt: now,
    createdById: input.actorId,
    createdByName: input.actorName,
    procedureId: original.procedureId,
    claimId: original.claimId,
    coverageId: original.coverageId,
    correctsEntryId: original.id,
    appliedExceptionId,
    memo,
    createdAt: now,
  };

  // The reversal first: the database admits the repost only behind it.
  await db.insert(ledgerEntries).values({
    ...shared,
    id: reversalId,
    kind: "reversal",
    amountCents: -original.amountCents,
    reversesEntryId: original.id,
    idempotencyKey: `correct-reversal-${original.id}`,
  });
  await db.insert(ledgerEntries).values({
    ...shared,
    id: repostId,
    kind: original.kind,
    amountCents: input.amountCents,
    tender: original.tender,
    idempotencyKey: `correct-repost-${original.id}`,
  });

  await appendControlEvent(
    db,
    input.tenantId,
    input.actorId,
    "ledger.corrected",
    {
      correctsEntryId: original.id,
      reversalId,
      repostId,
      reasonCode,
      fromCents: original.amountCents,
      toCents: input.amountCents,
      closedMonth: closedMonth ?? "",
    },
    now
  );

  return { ok: true, reversalId, repostId, reasonCode, closedMonth };
}
