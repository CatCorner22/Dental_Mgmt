import { eq, sql } from "drizzle-orm";
import {
  domainEvent,
  GENESIS_HASH,
  hashDomainEvent,
  importRuns,
  importStagedRows,
  uuidv7,
} from "@pms/db";
import {
  hashContent,
  hashRowPayload,
  parseCurveHeroReport,
  stageParsedRows,
  summarizeStagedRows,
  type CurveHeroReportKind,
  type ImportValidationSummary,
} from "@pms/import";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";

export type CreateImportRunInput = {
  tenantId: string;
  reportKind: CurveHeroReportKind;
  content: string;
  fileName?: string;
  locationId?: string | null;
  businessDate?: string | null;
  actorUserId: string;
  actorName: string;
  now?: Date;
};

export type ImportRunResult = {
  runId: string;
  status: "validated" | "failed";
  summary: ImportValidationSummary;
  warnings: string[];
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
  const occurredAt = at;
  const hash = hashDomainEvent({
    prevHash,
    tenantId,
    kind,
    payload,
    occurredAt: occurredAt.toISOString(),
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
    occurredAt,
  });
}

export async function createCurveHeroImportRun(
  db: AppDb,
  input: CreateImportRunInput
): Promise<ImportRunResult> {
  const now = input.now ?? new Date();
  const parsed = parseCurveHeroReport(input.reportKind, input.content);
  const staged = stageParsedRows(parsed.rows);
  const summary = summarizeStagedRows(input.reportKind, staged);
  const runId = uuidv7(now.getTime());
  const fileSha256 = hashContent(input.content);

  await db.insert(importRuns).values({
    id: runId,
    tenantId: input.tenantId,
    sourceSystem: "curve_hero",
    reportKind: input.reportKind,
    locationId: input.locationId ?? null,
    businessDate: input.businessDate ?? null,
    fileName: input.fileName ?? null,
    fileSha256,
    status: summary.status,
    rowCount: summary.rowCount,
    errorCount: summary.errorCount,
    summary,
    createdAt: now,
    createdById: input.actorUserId,
    createdByName: input.actorName,
    completedAt: now,
  });

  if (staged.length > 0) {
    await db.insert(importStagedRows).values(
      staged.map((row) => ({
        id: uuidv7(now.getTime() + row.rowNumber),
        tenantId: input.tenantId,
        runId,
        rowNumber: row.rowNumber,
        sourceKey: row.sourceKey,
        rowSha256: hashRowPayload(row.payload),
        payload: row.payload,
        validationErrors: row.validationErrors,
        createdAt: now,
      }))
    );
  }

  await appendEvent(db, input.tenantId, input.actorUserId, "import.curve_hero.staged", {
    runId,
    reportKind: input.reportKind,
    fileName: input.fileName ?? null,
    rowCount: summary.rowCount,
    errorCount: summary.errorCount,
    status: summary.status,
  }, now);

  return { runId, status: summary.status, summary, warnings: parsed.warnings };
}
