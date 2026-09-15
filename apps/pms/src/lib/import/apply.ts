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

export async function applyCurveHeroImport(
  db: AppDb,
  input: ApplyCurveImportInput
): Promise<ApplyCurveImportResult> {
  const now = input.now ?? new Date();
  const runs = await loadValidatedRuns(db, input.tenantId, input.runId);
  const result: ApplyCurveImportResult = {
    runIds: [],
    posted: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };

  if (runs.length === 0) return result;

  const post = createPostEntry(makePostgresLedgerWriter(db));
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

    let runPosted = 0;
    let runSkipped = 0;
    let runDuplicates = 0;

    for (const staged of stagedRows) {
      if (staged.validationErrors.length > 0) {
        runSkipped += 1;
        continue;
      }

      const payload = staged.payload as DaySheetRow;
      if (payload.kind !== "day_sheet") {
        runSkipped += 1;
        continue;
      }

      const mapping = mapDaySheetRow(payload);
      if (!mapping) {
        result.errors.push({
          runId: run.id,
          rowNumber: staged.rowNumber,
          code: "unsupported_transaction_type",
        });
        runSkipped += 1;
        continue;
      }

      const patientRef = await resolvePatientRef(db, input.tenantId, payload.patientMrn, patientCache);
      if (!patientRef) {
        result.errors.push({
          runId: run.id,
          rowNumber: staged.rowNumber,
          code: "patient_not_found",
        });
        runSkipped += 1;
        continue;
      }

      const locationId = await resolveLocationId(
        db,
        input.tenantId,
        payload.locationCode,
        locationCache
      );
      if (!locationId) {
        result.errors.push({
          runId: run.id,
          rowNumber: staged.rowNumber,
          code: "location_not_found",
        });
        runSkipped += 1;
        continue;
      }

      const postResult = await post({
        tenantId: input.tenantId,
        accountId: patientRef.accountId,
        patientId: patientRef.patientId,
        locationId,
        kind: mapping.kind,
        glBucket: mapping.glBucket,
        amountCents: mapping.amountCents,
        effectiveDate: payload.businessDate,
        createdById: input.actorUserId,
        createdByName: input.actorName,
        memo: payload.description,
        idempotencyKey: importCurveIdempotencyKey(run.id, staged.rowNumber),
      });

      if (!postResult.ok) {
        result.errors.push({
          runId: run.id,
          rowNumber: staged.rowNumber,
          code: postResult.code,
        });
        runSkipped += 1;
        continue;
      }

      if (postResult.duplicate) {
        runDuplicates += 1;
      } else {
        runPosted += 1;
      }
    }

    await db
      .update(importRuns)
      .set({ status: "applied", completedAt: now })
      .where(and(eq(importRuns.id, run.id), eq(importRuns.tenantId, input.tenantId)));

    await appendEvent(db, input.tenantId, input.actorUserId, "import.curve_hero.applied", {
      runId: run.id,
      reportKind: run.reportKind,
      posted: runPosted,
      skipped: runSkipped,
      duplicates: runDuplicates,
      errorCount: result.errors.filter((error) => error.runId === run.id).length,
    }, now);

    result.runIds.push(run.id);
    result.posted += runPosted;
    result.skipped += runSkipped;
    result.duplicates += runDuplicates;
  }

  return result;
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
