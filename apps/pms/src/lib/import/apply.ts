import { and, eq, sql } from "drizzle-orm";
import {
  domainEvent,
  GENESIS_HASH,
  hashDomainEvent,
  importRuns,
  importStagedRows,
  locations,
  uuidv7,
} from "@pms/db";
import type { DaySheetRow } from "@pms/import";
import { createPostEntry } from "@pms/ledger";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";
import { makePostgresLedgerWriter } from "../ledger/postgresWriter";
import { importCurveIdempotencyKey, mapDaySheetRow } from "./map";

type PatientRef = {
  patientId: string;
  accountId: string;
};

export type ApplyRowError = {
  runId: string;
  rowNumber: number;
  code: string;
};

export type ApplyCurveImportResult = {
  runIds: string[];
  posted: number;
  skipped: number;
  duplicates: number;
  errors: ApplyRowError[];
};

export type ApplyCurveImportInput = {
  tenantId: string;
  runId?: string;
  actorUserId: string;
  actorName: string;
  now?: Date;
};

/**
 * One row this import will post, with everything it needed to look up already
 * looked up (Increment 1.95).
 *
 * ## Why the apply is two halves now
 *
 * `POST /api/import/curve/apply` ran the whole thing inside
 * `withTenantAppendTransaction`, so every read went through `app_append` — a
 * role that exists to write chain rows and holds almost no SELECT. It read
 * `import_runs`, `import_staged_rows`, `patients` and `account_members`, and
 * held a grant on none of them, so the apply answered `permission denied`
 * (SQLSTATE 42501) for the whole life of this product. Increment 1.94 found
 * it by giving the route a screen, and migration 0056 granted the two staging
 * tables.
 *
 * The patient tables were deliberately left ungranted. Letting the role that
 * writes the chain read patient records is a decision about who may read a
 * patient, and the narrower answer is this: resolve first, as `app_rw`, then
 * write what was resolved, as `app_append`. A lookup has no business inside
 * the transaction that appends to the chain.
 */
export type PlannedEntry = {
  runId: string;
  rowNumber: number;
  accountId: string;
  patientId: string;
  locationId: string;
  kind: string;
  glBucket: string;
  amountCents: number;
  effectiveDate: string;
  /** The row's own description, which a day sheet may leave empty. */
  memo: string | null;
  idempotencyKey: string;
};

/** What one run contributes to the plan, read and counted before anything writes. */
export type PlannedRun = {
  runId: string;
  reportKind: string;
  /** Rows this import had no use for: invalid, not a day sheet, or unmapped. */
  skipped: number;
};

export type ImportPlan = {
  runs: PlannedRun[];
  entries: PlannedEntry[];
  errors: ApplyRowError[];
};

async function appendEvent(
  db: AppDb,
  tenantId: string,
  actorUserId: string,
  kind: string,
  payload: Record<string, unknown>,
  at: Date
) {
  await db.execute(TENANT_CHAIN_LOCK_SQL(tenantId));
  const [last] = await db
    .select({ hash: domainEvent.hash, seq: domainEvent.seq })
    .from(domainEvent)
    .where(eq(domainEvent.tenantId, tenantId))
    .orderBy(sql`${domainEvent.seq} desc`)
    .limit(1);
  const prevHash = last?.hash ?? GENESIS_HASH;
  const seq = (last?.seq ?? 0) + 1;
  const hash = hashDomainEvent({
    prevHash,
    tenantId,
    kind,
    payload,
    occurredAt: at.toISOString(),
  });
  await db.insert(domainEvent).values({
    id: uuidv7(at.getTime()),
    tenantId,
    actorUserId,
    kind,
    payload,
    prevHash,
    hash,
    seq,
    occurredAt: at,
  });
}

async function resolveLocationId(
  db: AppDb,
  tenantId: string,
  locationCode: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  const normalized = locationCode.trim().toLowerCase();
  if (cache.has(normalized)) return cache.get(normalized) ?? null;

  const rows = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.tenantId, tenantId));
  const match = rows.find((row) => row.name.trim().toLowerCase() === normalized);
  const resolved = match?.id ?? rows[0]?.id ?? null;
  cache.set(normalized, resolved);
  return resolved;
}

async function resolvePatientRef(
  db: AppDb,
  tenantId: string,
  mrn: string,
  cache: Map<string, PatientRef | null>
): Promise<PatientRef | null> {
  const key = mrn.trim();
  if (cache.has(key)) return cache.get(key) ?? null;

  const result = await db.execute<{
    patient_id: string;
    account_id: string;
  }>(sql`
    SELECT p.id AS patient_id, am.account_id
    FROM patients p
    JOIN account_members am
      ON am.patient_id = p.id
     AND am.tenant_id = p.tenant_id
     AND am.effective_to IS NULL
    WHERE p.tenant_id = ${tenantId}
      AND lower(p.mrn) = lower(${key})
    LIMIT 1
  `);

  const row = result.rows[0];
  const resolved = row ? { patientId: row.patient_id, accountId: row.account_id } : null;
  cache.set(key, resolved);
  return resolved;
}

async function loadValidatedRuns(
  db: AppDb,
  tenantId: string,
  runId?: string
): Promise<Array<typeof importRuns.$inferSelect>> {
  const conditions = [
    eq(importRuns.tenantId, tenantId),
    eq(importRuns.status, "validated"),
    eq(importRuns.reportKind, "day_sheet"),
  ];
  if (runId) conditions.push(eq(importRuns.id, runId));

  return db
    .select()
    .from(importRuns)
    .where(and(...conditions))
    .orderBy(importRuns.createdAt);
}

/**
 * Everything the apply needs to read, read as `app_rw` (Increment 1.95).
 *
 * Nothing here writes. It resolves each staged row to an account, a patient
 * and a location, counts what this import has no use for, and collects the
 * rows it could not resolve as errors — so the transaction that writes has
 * nothing left to look up.
 */
export async function planCurveHeroImport(
  db: AppDb,
  input: ApplyCurveImportInput
): Promise<ImportPlan> {
  const plan: ImportPlan = { runs: [], entries: [], errors: [] };
  const runs = await loadValidatedRuns(db, input.tenantId, input.runId);
  if (runs.length === 0) return plan;

  const locationCache = new Map<string, string | null>();
  const patientCache = new Map<string, PatientRef | null>();

  for (const run of runs) {
    const stagedRows = await db
      .select()
      .from(importStagedRows)
      .where(
        and(eq(importStagedRows.tenantId, input.tenantId), eq(importStagedRows.runId, run.id))
      )
      .orderBy(importStagedRows.rowNumber);

    let skipped = 0;

    for (const staged of stagedRows) {
      if (staged.validationErrors.length > 0) {
        skipped += 1;
        continue;
      }

      const payload = staged.payload as DaySheetRow;
      if (payload.kind !== "day_sheet") {
        skipped += 1;
        continue;
      }

      const mapping = mapDaySheetRow(payload);
      if (!mapping) {
        plan.errors.push({ runId: run.id, rowNumber: staged.rowNumber, code: "unsupported_transaction_type" });
        skipped += 1;
        continue;
      }

      const patientRef = await resolvePatientRef(db, input.tenantId, payload.patientMrn, patientCache);
      if (!patientRef) {
        plan.errors.push({ runId: run.id, rowNumber: staged.rowNumber, code: "patient_not_found" });
        skipped += 1;
        continue;
      }

      const locationId = await resolveLocationId(db, input.tenantId, payload.locationCode, locationCache);
      if (!locationId) {
        plan.errors.push({ runId: run.id, rowNumber: staged.rowNumber, code: "location_not_found" });
        skipped += 1;
        continue;
      }

      plan.entries.push({
        runId: run.id,
        rowNumber: staged.rowNumber,
        accountId: patientRef.accountId,
        patientId: patientRef.patientId,
        locationId,
        kind: mapping.kind,
        glBucket: mapping.glBucket,
        amountCents: mapping.amountCents,
        effectiveDate: payload.businessDate,
        memo: payload.description ?? null,
        idempotencyKey: importCurveIdempotencyKey(run.id, staged.rowNumber),
      });
    }

    plan.runs.push({ runId: run.id, reportKind: run.reportKind, skipped });
  }

  return plan;
}

/**
 * Everything the apply writes, written as `app_append` (Increment 1.95).
 *
 * It posts the rows the plan resolved, stamps each run `applied` and appends
 * one chain event per run. It looks nothing up: the tables it touches are the
 * ledger, `import_runs` and `domain_event`, which is exactly what the append
 * role is granted.
 *
 * The run is stamped only while it is still `validated`. The two halves are
 * separate transactions now, so a second apply can arrive between them — the
 * idempotency key on each entry already refuses to post a row twice, and this
 * keeps the stamp and its event honest about which attempt did the work.
 */
export async function writeCurveHeroImport(
  db: AppDb,
  plan: ImportPlan,
  input: ApplyCurveImportInput
): Promise<ApplyCurveImportResult> {
  const now = input.now ?? new Date();
  const result: ApplyCurveImportResult = {
    runIds: [],
    posted: 0,
    skipped: 0,
    duplicates: 0,
    errors: [...plan.errors],
  };
  if (plan.runs.length === 0) return result;

  const post = createPostEntry(makePostgresLedgerWriter(db));

  for (const run of plan.runs) {
    let runPosted = 0;
    let runDuplicates = 0;
    let runSkipped = run.skipped;

    for (const entry of plan.entries.filter((e) => e.runId === run.runId)) {
      const postResult = await post({
        tenantId: input.tenantId,
        accountId: entry.accountId,
        patientId: entry.patientId,
        locationId: entry.locationId,
        kind: entry.kind,
        glBucket: entry.glBucket,
        amountCents: entry.amountCents,
        effectiveDate: entry.effectiveDate,
        createdById: input.actorUserId,
        createdByName: input.actorName,
        memo: entry.memo ?? undefined,
        idempotencyKey: entry.idempotencyKey,
      } as Parameters<typeof post>[0]);

      if (!postResult.ok) {
        result.errors.push({ runId: run.runId, rowNumber: entry.rowNumber, code: postResult.code });
        runSkipped += 1;
        continue;
      }

      if (postResult.duplicate) runDuplicates += 1;
      else runPosted += 1;
    }

    const stamped = await db
      .update(importRuns)
      .set({ status: "applied", completedAt: now })
      .where(
        and(
          eq(importRuns.id, run.runId),
          eq(importRuns.tenantId, input.tenantId),
          eq(importRuns.status, "validated")
        )
      )
      .returning({ id: importRuns.id });
    if (stamped.length === 0) continue;

    await appendEvent(db, input.tenantId, input.actorUserId, "import.curve_hero.applied", {
      runId: run.runId,
      reportKind: run.reportKind,
      posted: runPosted,
      skipped: runSkipped,
      duplicates: runDuplicates,
      errorCount: result.errors.filter((error) => error.runId === run.runId).length,
    }, now);

    result.runIds.push(run.runId);
    result.posted += runPosted;
    result.skipped += runSkipped;
    result.duplicates += runDuplicates;
  }

  return result;
}

/**
 * Both halves on one connection, for a caller whose role can do both — the
 * `apply-cli` and the tests that drive the whole path. The route does not use
 * it: it plans in one transaction and writes in another, which is the point.
 */
export async function applyCurveHeroImport(
  db: AppDb,
  input: ApplyCurveImportInput
): Promise<ApplyCurveImportResult> {
  return writeCurveHeroImport(db, await planCurveHeroImport(db, input), input);
}

export async function hasValidatedCurveImportRun(
  db: AppDb,
  tenantId: string,
  runId: string
): Promise<boolean> {
  const [run] = await db
    .select({ id: importRuns.id })
    .from(importRuns)
    .where(
      and(
        eq(importRuns.tenantId, tenantId),
        eq(importRuns.id, runId),
        eq(importRuns.status, "validated"),
        eq(importRuns.reportKind, "day_sheet")
      )
    )
    .limit(1);
  return Boolean(run);
}
