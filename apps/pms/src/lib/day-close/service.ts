import { and, eq, isNull, sql } from "drizzle-orm";
import {
  bankAccounts,
  dayCloses,
  deposits,
  domainEvent,
  GENESIS_HASH,
  hashDomainEvent,
  importRuns,
  importStagedRows,
  ledgerEntries,
  locations,
  uuidv7,
} from "@pms/db";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";
import { loadActivePolicy } from "../controls/policy";
import { loadStaff } from "../controls/staff";
import { canSealDeposits, type SealVerdict } from "./seal";
import type { DayCloseSnapshot, DepositRow, LatePostingRow } from "./types";

type DepositSlipPayload = {
  kind: "deposit_slip";
  depositDate: string;
  locationCode: string;
  method: string;
  amountCents: number;
  reference: string | null;
};

type DaySheetPayload = {
  kind: "day_sheet";
  businessDate: string;
  locationCode: string;
  transactionType: string;
  amountCents: number;
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
  locationCode: string
): Promise<string | null> {
  const rows = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.tenantId, tenantId));
  const normalized = locationCode.trim().toLowerCase();
  const match = rows.find((row) => row.name.trim().toLowerCase() === normalized);
  return match?.id ?? rows[0]?.id ?? null;
}

function mapDeposit(row: typeof deposits.$inferSelect): DepositRow {
  return {
    depositId: row.id,
    locationId: row.locationId,
    businessDate: String(row.businessDate),
    method: row.method,
    amountCents: Number(row.amountCents),
    reference: row.reference,
    status: row.status,
    preparedByName: row.preparedByName,
  };
}

async function sumDaySheetCollections(
  db: AppDb,
  tenantId: string,
  locationId: string,
  businessDate: string
): Promise<number> {
  const locationRows = await db
    .select({ name: locations.name })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId)))
    .limit(1);
  const locationName = locationRows[0]?.name?.toLowerCase() ?? "main";

  const rows = await db
    .select({ payload: importStagedRows.payload })
    .from(importStagedRows)
    .innerJoin(importRuns, eq(importRuns.id, importStagedRows.runId))
    .where(
      and(eq(importStagedRows.tenantId, tenantId), eq(importRuns.reportKind, "day_sheet"))
    );

  let total = 0;
  for (const row of rows) {
    const payload = row.payload as DaySheetPayload;
    if (payload.kind !== "day_sheet") continue;
    if (payload.businessDate !== businessDate) continue;
    if (payload.locationCode.trim().toLowerCase() !== locationName) continue;
    if (!/payment/i.test(payload.transactionType)) continue;
    if (payload.amountCents < 0) total += Math.abs(payload.amountCents);
  }
  return total;
}

/**
 * The rows the database stamped against this frozen day (Increment 1.40).
 *
 * `closed_day_id` is written by a trigger at insert time, so this reads the
 * database's own record of what landed behind the seal rather than re-deriving
 * it from dates. A day that was open when the row posted carries no stamp, and
 * a seal taken afterward does not reach back and make one.
 */
async function loadLatePostings(db: AppDb, tenantId: string, dayCloseId: string): Promise<LatePostingRow[]> {
  const rows = await db
    .select({
      entryId: ledgerEntries.id,
      kind: ledgerEntries.kind,
      amountCents: ledgerEntries.amountCents,
      postedAt: ledgerEntries.postedAt,
      createdByName: ledgerEntries.createdByName,
      reasonCode: ledgerEntries.reasonCode,
      correctsEntryId: ledgerEntries.correctsEntryId,
      memo: ledgerEntries.memo,
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, tenantId), eq(ledgerEntries.closedDayId, dayCloseId)))
    .orderBy(ledgerEntries.postedAt);

  return rows.map((row) => ({
    entryId: row.entryId,
    kind: row.kind,
    amountCents: Number(row.amountCents),
    postedAt: row.postedAt.toISOString(),
    createdByName: row.createdByName,
    reasonCode: row.reasonCode,
    correctsEntryId: row.correctsEntryId,
    memo: row.memo,
  }));
}

export async function applyStagedDeposits(
  db: AppDb,
  input: {
    tenantId: string;
    bankAccountId: string;
    actorUserId: string;
    actorName: string;
    now?: Date;
  }
): Promise<{ created: number }> {
  const now = input.now ?? new Date();
  const staged = await db
    .select({
      stagedRowId: importStagedRows.id,
      payload: importStagedRows.payload,
    })
    .from(importStagedRows)
    .innerJoin(importRuns, eq(importRuns.id, importStagedRows.runId))
    .where(
      and(eq(importStagedRows.tenantId, input.tenantId), eq(importRuns.reportKind, "deposit_slip"))
    );

  let created = 0;
  for (const row of staged) {
    const payload = row.payload as DepositSlipPayload;
    if (payload.kind !== "deposit_slip") continue;
    const locationId = await resolveLocationId(db, input.tenantId, payload.locationCode);
    if (!locationId) continue;

    const inserted = await db
      .insert(deposits)
      .values({
        id: uuidv7(now.getTime() + created),
        tenantId: input.tenantId,
        locationId,
        bankAccountId: input.bankAccountId,
        businessDate: payload.depositDate,
        method: payload.method,
        amountCents: payload.amountCents,
        reference: payload.reference,
        status: "open",
        importStagedRowId: row.stagedRowId,
        preparedById: input.actorUserId,
        preparedByName: input.actorName,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [deposits.tenantId, deposits.importStagedRowId],
      })
      .returning({ id: deposits.id });

    if (inserted.length > 0) created += 1;
  }

  if (created > 0) {
    await appendEvent(db, input.tenantId, input.actorUserId, "deposit.staged_applied", {
      created,
      bankAccountId: input.bankAccountId,
    }, now);
  }

  return { created };
}

export async function getDayCloseSnapshot(
  db: AppDb,
  tenantId: string,
  locationId: string,
  businessDate: string
): Promise<DayCloseSnapshot> {
  const [closeRow] = await db
    .select()
    .from(dayCloses)
    .where(
      and(
        eq(dayCloses.tenantId, tenantId),
        eq(dayCloses.locationId, locationId),
        eq(dayCloses.businessDate, businessDate)
      )
    )
    .limit(1);

  const depositRows = await db
    .select()
    .from(deposits)
    .where(
      and(
        eq(deposits.tenantId, tenantId),
        eq(deposits.locationId, locationId),
        eq(deposits.businessDate, businessDate)
      )
    )
    .orderBy(deposits.createdAt);

  const depositTotal = depositRows.reduce((sum, row) => sum + Number(row.amountCents), 0);
  const daySheetTotal = await sumDaySheetCollections(db, tenantId, locationId, businessDate);

  if (closeRow) {
    const summary = (closeRow.summary ?? {}) as { dualRelease?: { status?: string; degradedOwnerSeal?: boolean } };
    const latePostings = await loadLatePostings(db, tenantId, closeRow.id);
    return {
      dayCloseId: closeRow.id,
      locationId,
      businessDate,
      status: closeRow.status as "open" | "frozen",
      depositTotalCents: Number(closeRow.depositTotalCents),
      daySheetTotalCents: Number(closeRow.daySheetTotalCents),
      varianceCents: Number(closeRow.varianceCents),
      deposits: depositRows.map(mapDeposit),
      frozenAt: closeRow.frozenAt?.toISOString() ?? null,
      frozenByName: closeRow.frozenByName,
      sealStatus: summary.dualRelease?.status ?? null,
      degradedOwnerSeal: summary.dualRelease?.degradedOwnerSeal ?? false,
      latePostings,
      latePostingTotalCents: latePostings.reduce((sum, row) => sum + row.amountCents, 0),
    };
  }

  return {
    dayCloseId: null,
    locationId,
    businessDate,
    status: "open",
    depositTotalCents: depositTotal,
    daySheetTotalCents: daySheetTotal,
    varianceCents: depositTotal - daySheetTotal,
    deposits: depositRows.map(mapDeposit),
    frozenAt: null,
    frozenByName: null,
    sealStatus: null,
    degradedOwnerSeal: false,
    latePostings: [],
    latePostingTotalCents: 0,
  };
}

export type FreezeRefusal = {
  error: "already_frozen" | "no_deposits" | "sod_preparer" | "sod_role";
  verb?: string;
  why?: string;
  otherEligibleNames?: string[];
};

export async function freezeDayClose(
  db: AppDb,
  input: {
    tenantId: string;
    locationId: string;
    businessDate: string;
    actorUserId: string;
    actorName: string;
    now?: Date;
  }
): Promise<DayCloseSnapshot | FreezeRefusal> {
  const now = input.now ?? new Date();
  const snapshot = await getDayCloseSnapshot(
    db,
    input.tenantId,
    input.locationId,
    input.businessDate
  );

  if (snapshot.status === "frozen") return { error: "already_frozen" };
  if (snapshot.deposits.length === 0) return { error: "no_deposits" };

  // Dual count before the bag is sealed: the freezer is the second counter.
  const depositRows = await db
    .select({ preparedById: deposits.preparedById, amountCents: deposits.amountCents })
    .from(deposits)
    .where(
      and(
        eq(deposits.tenantId, input.tenantId),
        eq(deposits.locationId, input.locationId),
        eq(deposits.businessDate, input.businessDate)
      )
    );
  const active = await loadActivePolicy(db, input.tenantId);
  const staff = await loadStaff(db, input.tenantId, now);
  const actorRow = staff.rows.find((r) => r.id === input.actorUserId);
  const seal: SealVerdict = canSealDeposits({
    actor: { id: input.actorUserId, name: input.actorName, role: actorRow?.role ?? "user" },
    deposits: depositRows.map((d) => ({ preparedById: d.preparedById, amountCents: Number(d.amountCents) })),
    policy: active?.policy ?? null,
    people: staff.people,
  });
  if (!seal.ok) {
    return {
      error: seal.status === "blocked_same_person" ? "sod_preparer" : "sod_role",
      verb: seal.verb,
      why: seal.why,
      otherEligibleNames: seal.otherEligibleNames,
    };
  }

  const dayCloseId = snapshot.dayCloseId ?? uuidv7(now.getTime());
  const summary: Record<string, unknown> = {
    depositCount: snapshot.deposits.length,
    source: "manual_freeze",
    dualRelease: {
      channel: "deposit",
      status: seal.status,
      dualRequired: seal.dualRequired,
      thresholdUsd: seal.thresholdUsd,
      preparerIds: seal.preparerIds,
      sealedById: input.actorUserId,
      degradedOwnerSeal: seal.degradedOwnerSeal,
      policyVersion: active?.version ?? null,
    },
  };
  if (seal.degradedOwnerSeal) {
    summary.degradedOwnerSealFinding = {
      kind: "degraded_owner_seal",
      why: seal.why,
      recordedAt: now.toISOString(),
    };
  }

  if (snapshot.dayCloseId) {
    await db
      .update(dayCloses)
      .set({
        status: "frozen",
        depositTotalCents: snapshot.depositTotalCents,
        daySheetTotalCents: snapshot.daySheetTotalCents,
        varianceCents: snapshot.varianceCents,
        summary,
        frozenAt: now,
        frozenById: input.actorUserId,
        frozenByName: input.actorName,
      })
      .where(eq(dayCloses.id, dayCloseId));
  } else {
    await db.insert(dayCloses).values({
      id: dayCloseId,
      tenantId: input.tenantId,
      locationId: input.locationId,
      businessDate: input.businessDate,
      status: "frozen",
      depositTotalCents: snapshot.depositTotalCents,
      daySheetTotalCents: snapshot.daySheetTotalCents,
      varianceCents: snapshot.varianceCents,
      summary,
      frozenAt: now,
      frozenById: input.actorUserId,
      frozenByName: input.actorName,
      createdAt: now,
    });
  }

  await db
    .update(deposits)
    .set({ status: "closed", dayCloseId })
    .where(
      and(
        eq(deposits.tenantId, input.tenantId),
        eq(deposits.locationId, input.locationId),
        eq(deposits.businessDate, input.businessDate),
        isNull(deposits.dayCloseId)
      )
    );

  await appendEvent(db, input.tenantId, input.actorUserId, "day_close.frozen", {
    dayCloseId,
    locationId: input.locationId,
    businessDate: input.businessDate,
    depositTotalCents: snapshot.depositTotalCents,
    daySheetTotalCents: snapshot.daySheetTotalCents,
    varianceCents: snapshot.varianceCents,
    dualReleaseStatus: seal.status,
    dualRequired: seal.dualRequired,
    degradedOwnerSeal: seal.degradedOwnerSeal,
    preparerIds: seal.preparerIds,
  }, now);

  return getDayCloseSnapshot(db, input.tenantId, input.locationId, input.businessDate);
}

export async function defaultBankAccountId(db: AppDb, tenantId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(eq(bankAccounts.tenantId, tenantId))
    .limit(1);
  return row?.id ?? null;
}
