import { desc, eq } from "drizzle-orm";
import { takeControlSnapshot, type ControlSnapshot } from "@pms/controls-engine";
import { controlSnapshots, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { runDetectors } from "./detectors";
import { appendControlEvent } from "./events";
import { refreshSodFindings } from "./findings";
import { loadControlsContext, type ControlsContext } from "./practiceState";
import { matchingSummary } from "./matchingMeasure";
import { measurementSummary } from "./reconciliationMeasure";

export type SnapshotTrigger = "manual" | "grant" | "revoke" | "policy" | "nightly" | "seed";

export type StoredSnapshot = {
  id: string;
  takenAt: string;
  trigger: string;
  snapshot: ControlSnapshot;
};

/** Computes every score from live rows without writing anything. */
export async function computeSnapshot(db: AppDb, tenantId: string, now: Date = new Date()): Promise<{
  ctx: ControlsContext;
  snapshot: ControlSnapshot;
}> {
  const ctx = await loadControlsContext(db, tenantId, now);
  const snapshot = takeControlSnapshot({
    state: ctx.built.state,
    sod: ctx.built.sod,
    coverage: ctx.built.coverage,
    decisions: ctx.decisions,
    takenAt: now.toISOString(),
    measurements: {
      reconciliation: measurementSummary(ctx.reconciliation),
      matching: matchingSummary(ctx.matching),
    },
  });
  return { ctx, snapshot };
}

/**
 * Freezes the scores into control_snapshots, refreshes the SoD findings
 * table so the two agree, runs the detectors so their findings are current
 * on the same clock, and appends control.snapshot with the headline only.
 */
export async function takeSnapshot(
  db: AppDb,
  input: { tenantId: string; actor?: { id: string; name: string }; trigger: SnapshotTrigger; now?: Date }
): Promise<StoredSnapshot> {
  const now = input.now ?? new Date();
  const { ctx, snapshot } = await computeSnapshot(db, input.tenantId, now);
  await refreshSodFindings(db, input.tenantId, ctx.built.sod, now, ctx.decisions);
  await runDetectors(db, input.tenantId, now);

  const id = uuidv7(now.getTime());
  await db.insert(controlSnapshots).values({
    id,
    tenantId: input.tenantId,
    takenAt: now,
    trigger: input.trigger,
    scoringVersion: snapshot.scoringVersion,
    rulebookVersion: snapshot.rulebookVersion,
    averageResidual: snapshot.headline.averageResidual,
    cosoOverall: snapshot.headline.cosoOverall,
    pressureIndex: snapshot.headline.pressureIndex,
    segregationHealth: snapshot.headline.segregationHealth,
    openConflicts: snapshot.headline.openConflicts,
    conflictsWithoutDecision: snapshot.headline.conflictsWithoutDecision,
    snapshot,
    takenById: input.actor?.id ?? null,
  });

  if (input.actor) {
    await appendControlEvent(
      db,
      input.tenantId,
      input.actor.id,
      "control.snapshot",
      { snapshotId: id, trigger: input.trigger, ...snapshot.headline },
      now
    );
  }

  return { id, takenAt: now.toISOString(), trigger: input.trigger, snapshot };
}

export async function latestSnapshot(db: AppDb, tenantId: string): Promise<StoredSnapshot | null> {
  const rows = await db
    .select()
    .from(controlSnapshots)
    .where(eq(controlSnapshots.tenantId, tenantId))
    .orderBy(desc(controlSnapshots.takenAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    takenAt: row.takenAt.toISOString(),
    trigger: row.trigger,
    snapshot: row.snapshot as ControlSnapshot,
  };
}
