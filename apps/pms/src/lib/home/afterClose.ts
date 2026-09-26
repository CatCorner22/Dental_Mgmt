import { sql } from "drizzle-orm";
import type { AppDb } from "../db/client";

/**
 * What has posted into days the practice had already sealed (Increment 1.41).
 *
 * Increment 1.40 made the database stamp every ledger row it admits against a
 * frozen day close. This reads those stamps back as two practice-level counts:
 * what landed behind yesterday's seals, and what landed behind any seal in the
 * window. Neither names a person. A pattern of late postings is a practice
 * fact, and the board is where a practice fact belongs.
 *
 * The two counts answer different questions. Yesterday's answers "did the day I
 * sealed move afterward". The window's answers "does this keep happening",
 * which is the one a single clean day cannot answer and the one that matters:
 * sealing a day at the figure the owner expects and posting the rest later
 * shows up as a habit long before it shows up as a variance.
 */

export const AFTER_CLOSE_WINDOW_DAYS = 30;

export type AfterCloseCount = {
  rows: number;
  /** What those rows move the sealed days by, in the ledger's own signs. */
  netCents: number;
  /** How many sealed days they touched. */
  daysTouched: number;
  /**
   * Of the rows, the ones that are not half of a correction. A correction
   * names the entry it replaces; a first posting names nothing, which is
   * exactly why it is counted separately.
   */
  firstPostings: number;
};

export type AfterCloseCard = {
  windowDays: number;
  yesterday: AfterCloseCount;
  window: AfterCloseCount;
  headline: string;
  why: string;
  action: { label: string; href: string } | null;
};

const EMPTY: AfterCloseCount = { rows: 0, netCents: 0, daysTouched: 0, firstPostings: 0 };

/** The date `days` before `asOf`, as YYYY-MM-DD. */
function daysBefore(asOf: string, days: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Both counts in one pass over the stamps. The join is the proof: a row counts
 * only where it carries a `closed_day_id`, which only the trigger writes.
 */
export async function countPostingsAfterClose(
  db: AppDb,
  tenantId: string,
  asOf: string,
  yesterday: string,
  windowDays = AFTER_CLOSE_WINDOW_DAYS
): Promise<{ yesterday: AfterCloseCount; window: AfterCloseCount }> {
  const windowStart = daysBefore(asOf, windowDays);
  const { rows } = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE dc.business_date = ${yesterday}::date)::int AS y_rows,
      coalesce(sum(le.amount_cents) FILTER (WHERE dc.business_date = ${yesterday}::date), 0)::bigint AS y_net,
      count(DISTINCT dc.id) FILTER (WHERE dc.business_date = ${yesterday}::date)::int AS y_days,
      count(*) FILTER (WHERE dc.business_date = ${yesterday}::date AND le.corrects_entry_id IS NULL)::int AS y_first,
      count(*)::int AS w_rows,
      coalesce(sum(le.amount_cents), 0)::bigint AS w_net,
      count(DISTINCT dc.id)::int AS w_days,
      count(*) FILTER (WHERE le.corrects_entry_id IS NULL)::int AS w_first
    FROM ledger_entries le
    JOIN day_closes dc ON dc.id = le.closed_day_id
    WHERE le.tenant_id = ${tenantId}
      AND le.posted_after_close
      AND dc.business_date >= ${windowStart}::date
  `);

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return { yesterday: EMPTY, window: EMPTY };
  return {
    yesterday: {
      rows: Number(row.y_rows),
      netCents: Number(row.y_net),
      daysTouched: Number(row.y_days),
      firstPostings: Number(row.y_first),
    },
    window: {
      rows: Number(row.w_rows),
      netCents: Number(row.w_net),
      daysTouched: Number(row.w_days),
      firstPostings: Number(row.w_first),
    },
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * What the rows are made of, in words that read as a sentence in every count.
 * The split matters more than the total: a correction names the entry it
 * replaces, and a first posting names nothing.
 */
function shapeOf(c: AfterCloseCount): string {
  if (c.firstPostings === 0) return c.rows === 1 ? "all of it a correction" : "all of them corrections";
  if (c.firstPostings === c.rows) return c.rows === 1 ? "a first posting" : "all of them first postings";
  return c.firstPostings === 1
    ? "one a first posting, the rest corrections"
    : `${c.firstPostings} of them first postings, the rest corrections`;
}

/**
 * The card, in the practice's words. Three states, and the quiet one is said
 * out loud rather than hidden: an owner who never sees this card cannot tell
 * whether it is clean or broken.
 */
export function afterCloseCard(
  counts: { yesterday: AfterCloseCount; window: AfterCloseCount },
  windowDays = AFTER_CLOSE_WINDOW_DAYS
): AfterCloseCard {
  const base = { windowDays, yesterday: counts.yesterday, window: counts.window };

  if (counts.window.rows === 0) {
    return {
      ...base,
      headline: "Nothing posted into a sealed day",
      why: `No ledger row has landed behind a frozen day close in the last ${windowDays} days. A sealed day still reads as the practice counted it.`,
      action: null,
    };
  }

  if (counts.yesterday.rows > 0) {
    return {
      ...base,
      headline: `Yesterday changed after close: ${plural(counts.yesterday.rows, "row", "rows")}`,
      why:
        `${plural(counts.yesterday.rows, "row", "rows")} posted into yesterday's sealed ` +
        `${counts.yesterday.daysTouched === 1 ? "day" : `days (${counts.yesterday.daysTouched})`} — ${shapeOf(counts.yesterday)}. ` +
        `The sealed figures do not move, so yesterday now reads two ways. ` +
        `Over the last ${windowDays} days, ${plural(counts.window.rows, "row", "rows")} across ${plural(counts.window.daysTouched, "sealed day", "sealed days")}.`,
      action: { label: "Open the sealed day", href: "/day-close" },
    };
  }

  return {
    ...base,
    headline: `Postings into closed days: ${plural(counts.window.rows, "row", "rows")}`,
    why:
      `Yesterday's seals hold. Over the last ${windowDays} days, ` +
      `${plural(counts.window.rows, "row", "rows")} landed behind a seal across ` +
      `${plural(counts.window.daysTouched, "sealed day", "sealed days")} — ${shapeOf(counts.window)}. ` +
      `A correction names the entry it replaces; a first posting names nothing, which is why the two are counted apart.`,
    action: { label: "Open the day close", href: "/day-close" },
  };
}
