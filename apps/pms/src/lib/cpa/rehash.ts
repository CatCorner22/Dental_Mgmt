import { and, eq } from "drizzle-orm";
import { monthCloseRehashes, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { loadMonthClose } from "./close";
import { computeMonthPackage, packageHash, PACKAGE_SCHEMA_VERSION } from "./package";

/**
 * Comparing a month closed under an older package shape (Increment 1.56).
 *
 * Increment 1.43 made the shape part of the hash and recorded it on the close,
 * so the page can tell "the package changed shape" from "a figure moved"
 * rather than reporting the first as the second forever. That was the honest
 * answer and it has a cost: such a month can never again be asked whether a
 * figure moved, and only the entry count and journal total the close froze in
 * their own columns still answer — two figures out of the many the package
 * states. The shape has moved five times since, so this is most closed months.
 *
 * Recomputing the hash onto the close would be the wrong fix, and the close
 * table says so: it refuses every update and every delete. That frozen hash is
 * what the accountant received, and overwriting it would assert something false
 * about the past to answer a question about the present.
 *
 * A baseline is an addition instead. It says: under this shape, as of this
 * moment, the month hashed to this. The close goes on saying what was received;
 * the baseline gives the "moved since?" question something to compare against
 * again, and names the date from which that claim runs.
 */

export type RehashBaseline = {
  month: string;
  packageSchema: string;
  packageHash: string;
  entryCount: number;
  totalCents: number;
  computedByName: string;
  /** ISO timestamp. */
  computedAt: string;
};

/**
 * What a reader may conclude about a closed month right now.
 *
 * `same_shape` — the close and the package agree on shape, so the frozen hash
 * answers directly, as it has since Increment 1.36.
 * `older_shape_no_baseline` — the hashes do not compare and nothing else does
 * either; the honest report is that the shape changed, and a baseline may be
 * taken.
 * `older_shape_with_baseline` — the shape still differs from the close, but a
 * baseline under the current shape exists, so "moved since" is answerable
 * again, from the baseline's date rather than the close's.
 */
export type CloseComparison =
  | { state: "not_closed" }
  | { state: "same_shape"; movedSinceClose: boolean }
  | { state: "older_shape_no_baseline"; closedUnder: string; sentence: string }
  | { state: "older_shape_with_baseline"; closedUnder: string; movedSinceBaseline: boolean; takenAt: string; sentence: string };

/**
 * Reads that state from figures alone, so the page and the tests agree about
 * what the hashes can and cannot support.
 */
export function compareClose(input: {
  closedUnder: string | null;
  closeHash: string | null;
  currentSchema: string;
  currentHash: string;
  baseline: { packageSchema: string; packageHash: string; computedAt: string } | null;
}): CloseComparison {
  if (!input.closedUnder || !input.closeHash) return { state: "not_closed" };
  if (input.closedUnder === input.currentSchema) {
    return { state: "same_shape", movedSinceClose: input.closeHash !== input.currentHash };
  }
  const baseline = input.baseline?.packageSchema === input.currentSchema ? input.baseline : null;
  if (!baseline) {
    return {
      state: "older_shape_no_baseline",
      closedUnder: input.closedUnder,
      sentence:
        `This month was closed under ${input.closedUnder} and the package now reads ${input.currentSchema}, so the two hashes do not compare and nothing here can say whether a figure moved. ` +
        "Recording a baseline under the current shape makes that answerable again, from the day it is taken rather than from the close.",
    };
  }
  const moved = baseline.packageHash !== input.currentHash;
  return {
    state: "older_shape_with_baseline",
    closedUnder: input.closedUnder,
    movedSinceBaseline: moved,
    takenAt: baseline.computedAt,
    sentence: moved
      ? `A figure this month states has moved since the baseline taken on ${baseline.computedAt.slice(0, 10)} under ${input.currentSchema}. The close's own hash is older still and says only what the accountant received.`
      : `Nothing this month states has moved since the baseline taken on ${baseline.computedAt.slice(0, 10)} under ${input.currentSchema}. That claim runs from the baseline, not from the close.`,
  };
}

export type BaselineRefusal = {
  ok: false;
  status: 404 | 409;
  code: "not_closed" | "already_baselined" | "same_shape";
  verb: string;
  why: string;
};

export type BaselineResult = { ok: true; baseline: RehashBaseline } | BaselineRefusal;

export async function loadRehashBaseline(db: AppDb, tenantId: string, month: string): Promise<RehashBaseline | null> {
  const rows = await db
    .select()
    .from(monthCloseRehashes)
    .where(
      and(
        eq(monthCloseRehashes.tenantId, tenantId),
        eq(monthCloseRehashes.month, month),
        eq(monthCloseRehashes.packageSchema, PACKAGE_SCHEMA_VERSION)
      )
    )
    .limit(1);
  const row = rows[0];
  return row
    ? {
        month: row.month,
        packageSchema: row.packageSchema,
        packageHash: row.packageHash,
        entryCount: row.entryCount,
        totalCents: Number(row.totalCents),
        computedByName: row.computedByName,
        computedAt: row.computedAt.toISOString(),
      }
    : null;
}

/**
 * Takes the baseline for one closed month under the shape the package reads now.
 *
 * Refuses a month that was never closed (404 — there is nothing frozen to
 * compare against), one closed under the shape in force (409 — the close is
 * already its own baseline), and one that has a baseline under this shape
 * already (409 — the first reading is the baseline, and a second would move
 * the line a later comparison is drawn from).
 */
export async function recordRehashBaseline(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; month: string; now?: Date }
): Promise<BaselineResult> {
  const now = input.now ?? new Date();
  const close = await loadMonthClose(db, input.tenantId, input.month);
  if (!close) {
    return { ok: false, status: 404, code: "not_closed", verb: "Not recorded", why: "This month has not been closed, so there is nothing frozen to compare against." };
  }
  if (close.packageSchema === PACKAGE_SCHEMA_VERSION) {
    return {
      ok: false,
      status: 409,
      code: "same_shape",
      verb: "Not needed",
      why: `This month was closed under ${close.packageSchema}, which the package still reads, so its own frozen hash already answers.`,
    };
  }
  const existing = await loadRehashBaseline(db, input.tenantId, input.month);
  if (existing) {
    return {
      ok: false,
      status: 409,
      code: "already_baselined",
      verb: "Already recorded",
      why: `${existing.computedByName} took this month's baseline under ${existing.packageSchema} on ${existing.computedAt.slice(0, 10)}. The first reading is the baseline; a second would move the line a later comparison is drawn from.`,
    };
  }

  const pkg = await computeMonthPackage(db, input.tenantId, input.month);
  const baseline: RehashBaseline = {
    month: input.month,
    packageSchema: PACKAGE_SCHEMA_VERSION,
    packageHash: packageHash(pkg),
    entryCount: pkg.journal.entryCount,
    totalCents: pkg.journal.totalCents,
    computedByName: input.actor.name,
    computedAt: now.toISOString(),
  };
  await db.insert(monthCloseRehashes).values({
    id: uuidv7(now.getTime()),
    tenantId: input.tenantId,
    month: baseline.month,
    packageSchema: baseline.packageSchema,
    packageHash: baseline.packageHash,
    entryCount: baseline.entryCount,
    totalCents: baseline.totalCents,
    computedById: input.actor.id,
    computedByName: input.actor.name,
    computedAt: now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "month.rehash_baseline",
    { month: baseline.month, packageSchema: baseline.packageSchema, closedUnder: close.packageSchema },
    now
  );
  return { ok: true, baseline };
}
