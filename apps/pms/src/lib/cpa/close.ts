import { and, asc, eq } from "drizzle-orm";
import { monthCloses, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { computeMonthPackage, isMonth, monthPeriod, packageHash } from "./package";

/**
 * Closing a month (docs/13 item 22, Increment 1.36). Closing freezes what
 * the practice told its accountant: the period, the package hash at the
 * moment of closing, the journal's entry count and total, and who closed
 * it. A month is never re-opened, because re-opening would make the frozen
 * hash a lie; a later correction posts today with reason `prior_period`,
 * which the database permits and the retroactive-entry hard event surfaces.
 */

export type MonthClose = {
  id: string;
  month: string;
  periodStart: string;
  periodEnd: string;
  packageHash: string;
  entryCount: number;
  totalCents: number;
  closedById: string;
  closedByName: string;
  /** ISO timestamp. */
  closedAt: string;
};

/** The reason code a correction into a closed month must carry. */
export const PRIOR_PERIOD_REASON = "prior_period";

function mapRow(row: typeof monthCloses.$inferSelect): MonthClose {
  return {
    id: row.id,
    month: row.month,
    periodStart: String(row.periodStart),
    periodEnd: String(row.periodEnd),
    packageHash: row.packageHash,
    entryCount: row.entryCount,
    totalCents: Number(row.totalCents),
    closedById: row.closedById,
    closedByName: row.closedByName,
    closedAt: row.closedAt.toISOString(),
  };
}

export async function listMonthCloses(db: AppDb, tenantId: string): Promise<MonthClose[]> {
  const rows = await db.select().from(monthCloses).where(eq(monthCloses.tenantId, tenantId)).orderBy(asc(monthCloses.month));
  return rows.map(mapRow);
}

export async function loadMonthClose(db: AppDb, tenantId: string, month: string): Promise<MonthClose | null> {
  const rows = await db
    .select()
    .from(monthCloses)
    .where(and(eq(monthCloses.tenantId, tenantId), eq(monthCloses.month, month)));
  return rows[0] ? mapRow(rows[0]) : null;
}

export type CloseMonthResult =
  | { ok: true; close: MonthClose }
  | { ok: false; status: 400 | 409; errors: string[] };

/**
 * Closes a month. Refuses a month that has not ended (its rows are still
 * arriving), one already closed (naming who closed it), and one whose
 * journal still holds a line no approved mapping covers, since the
 * accountant would receive a frozen package that cannot be posted to a
 * chart of accounts. Writes one append-only row and one chain event.
 */
export async function closeMonth(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; month: string; now?: Date }
): Promise<CloseMonthResult> {
  const now = input.now ?? new Date();
  if (!isMonth(input.month)) return { ok: false, status: 400, errors: ["The month must be a calendar month (YYYY-MM)."] };
  const thisMonth = now.toISOString().slice(0, 7);
  if (input.month >= thisMonth) {
    return { ok: false, status: 400, errors: ["A month is closed once it has ended; this one is still taking rows."] };
  }

  const existing = await loadMonthClose(db, input.tenantId, input.month);
  if (existing) {
    return { ok: false, status: 409, errors: [`${input.month} was closed by ${existing.closedByName} on ${existing.closedAt.slice(0, 10)}. A closed month is never re-opened.`] };
  }

  const pkg = await computeMonthPackage(db, input.tenantId, input.month);
  if (pkg.mappings.unmappedLines > 0) {
    return {
      ok: false,
      status: 409,
      errors: [
        `${pkg.mappings.unmappedLines} journal line${pkg.mappings.unmappedLines === 1 ? "" : "s"} still have no approved account mapping. Map them first, or the accountant receives a frozen month they cannot post.`,
      ],
    };
  }

  const period = monthPeriod(input.month);
  const hash = packageHash(pkg);
  const id = uuidv7(now.getTime());
  await db.insert(monthCloses).values({
    id,
    tenantId: input.tenantId,
    month: input.month,
    periodStart: period.start,
    periodEnd: period.end,
    packageHash: hash,
    entryCount: pkg.journal.entryCount,
    totalCents: pkg.journal.totalCents,
    closedById: input.actor.id,
    closedByName: input.actor.name,
    closedAt: now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "month.closed",
    { closeId: id, month: input.month, packageHash: hash, entryCount: pkg.journal.entryCount, totalCents: pkg.journal.totalCents },
    now
  );
  return { ok: true, close: (await loadMonthClose(db, input.tenantId, input.month))! };
}
