import { and, eq, sql, type SQL } from "drizzle-orm";
import {
  bankAccounts,
  deposits,
  domainEvent,
  GENESIS_HASH,
  hashDomainEvent,
  ledgerEntries,
  reconciliationRuns,
  reconciliationVariances,
  userEntitlements,
  users,
  uuidv7,
} from "@pms/db";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";
import { getReconciliationRun } from "./queries";
import type { ReconciliationRunDetail, VarianceClearanceVerdict } from "./types";

export type ClearancePerson = {
  id: string;
  role: string;
  entitlements: string[];
};

export type ClearanceRun = {
  status: string;
  source: string;
  periodStart: string;
  periodEnd: string;
};

export type DepositForPeriod = {
  preparedById: string;
};

export type CanClearVarianceInput = {
  actor: ClearancePerson;
  run: ClearanceRun;
  depositsForPeriod: DepositForPeriod[];
  entitlements: ClearancePerson[];
  paymentPosterIds?: string[];
};

const SOD_VERB = "Needs someone other than the deposit preparer";
const SOD_WHY_PREPARER =
  "Whoever prepared this day's deposit cannot clear its bank variance.";
const SOD_WHY_POSTER =
  "Whoever posted payments that day cannot clear its bank variance.";

function personConflicted(
  person: ClearancePerson,
  depositsForPeriod: DepositForPeriod[],
  paymentPosterIds: string[]
): { prepared: boolean; posted: boolean } {
  const prepared = depositsForPeriod.some((row) => row.preparedById === person.id);
  const posted =
    paymentPosterIds.includes(person.id) ||
    (person.entitlements.includes("post_payments") && prepared);
  return { prepared, posted };
}

function isConflicted(
  person: ClearancePerson,
  depositsForPeriod: DepositForPeriod[],
  paymentPosterIds: string[]
): boolean {
  const flags = personConflicted(person, depositsForPeriod, paymentPosterIds);
  return flags.prepared || flags.posted;
}

/**
 * Runtime SoD for variance clearance (decision 7a).
 * Poster / deposit preparer cannot clear that day's run unless the office
 * degrades to owner-only clearance and records that as a finding.
 */
export function canClearVariance(input: CanClearVarianceInput): VarianceClearanceVerdict {
  const paymentPosterIds = input.paymentPosterIds ?? [];

  if (input.run.source !== "statement_import") {
    return {
      ok: false,
      code: "not_independent",
      verb: "Clearing needs a statement import",
      why: "Variance clearance is not a self-assertion. Import a bank statement first.",
      degradedOwnerClearance: false,
    };
  }

  if (input.run.status === "cleared") {
    return {
      ok: false,
      code: "already_cleared",
      verb: "This run is already cleared",
      why: "A cleared reconciliation run cannot be cleared again.",
      degradedOwnerClearance: false,
    };
  }

  if (!input.actor.entitlements.includes("bank_reconcile")) {
    return {
      ok: false,
      code: "missing_entitlement",
      verb: "Needs bank reconcile rights",
      why: "Clearing a reconciliation run requires the bank_reconcile entitlement.",
      degradedOwnerClearance: false,
    };
  }

  const otherEligible = input.entitlements.filter(
    (person) =>
      person.id !== input.actor.id &&
      person.entitlements.includes("bank_reconcile") &&
      !isConflicted(person, input.depositsForPeriod, paymentPosterIds)
  );

  const actorFlags = personConflicted(input.actor, input.depositsForPeriod, paymentPosterIds);
  const actorConflicted = actorFlags.prepared || actorFlags.posted;
  const tinyOfficeDegrade = input.actor.role === "admin" && otherEligible.length === 0;

  if (actorConflicted && !tinyOfficeDegrade) {
    return {
      ok: false,
      code: "sod_preparer",
      verb: SOD_VERB,
      why: actorFlags.prepared ? SOD_WHY_PREPARER : SOD_WHY_POSTER,
      degradedOwnerClearance: false,
    };
  }

  if (actorConflicted && tinyOfficeDegrade) {
    return {
      ok: true,
      code: "degraded_owner_clearance",
      verb: "Clear as owner",
      why: "No other eligible person exists. Owner-only clearance will be recorded as a finding.",
      degradedOwnerClearance: true,
    };
  }

  return {
    ok: true,
    code: "allowed",
    verb: "Clear variances",
    why: "Independent clearance from statement import.",
    degradedOwnerClearance: false,
  };
}

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
    actorUserId,
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

export async function listStaffEntitlements(
  db: AppDb,
  tenantId: string
): Promise<ClearancePerson[]> {
  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      entitlement: userEntitlements.entitlement,
    })
    .from(users)
    .leftJoin(
      userEntitlements,
      and(eq(userEntitlements.userId, users.id), eq(userEntitlements.tenantId, users.tenantId))
    )
    .where(and(eq(users.tenantId, tenantId), eq(users.active, true)));

  const byId = new Map<string, ClearancePerson>();
  for (const row of rows) {
    let person = byId.get(row.id);
    if (!person) {
      person = { id: row.id, role: row.role, entitlements: [] };
      byId.set(row.id, person);
    }
    if (row.entitlement && !person.entitlements.includes(row.entitlement)) {
      person.entitlements.push(row.entitlement);
    }
  }
  return [...byId.values()];
}

export async function listDepositsForRunPeriod(
  db: AppDb,
  input: {
    tenantId: string;
    bankAccountId: string;
    periodStart: string;
    periodEnd: string;
  }
): Promise<DepositForPeriod[]> {
  const rows = await db
    .select({ preparedById: deposits.preparedById })
    .from(deposits)
    .where(
      and(
        eq(deposits.tenantId, input.tenantId),
        eq(deposits.bankAccountId, input.bankAccountId),
        sql`${deposits.businessDate} >= ${input.periodStart}`,
        sql`${deposits.businessDate} <= ${input.periodEnd}`
      )
    );
  return rows.map((row) => ({ preparedById: row.preparedById }));
}

export async function listPaymentPosterIds(
  db: AppDb,
  input: {
    tenantId: string;
    periodStart: string;
    periodEnd: string;
    locationId: string | null;
  }
): Promise<string[]> {
  const filters: SQL[] = [
    eq(ledgerEntries.tenantId, input.tenantId),
    eq(ledgerEntries.kind, "patient_payment"),
    sql`${ledgerEntries.effectiveDate} >= ${input.periodStart}`,
    sql`${ledgerEntries.effectiveDate} <= ${input.periodEnd}`,
  ];
  if (input.locationId) {
    filters.push(eq(ledgerEntries.locationId, input.locationId));
  }
  const rows = await db
    .select({ createdById: ledgerEntries.createdById })
    .from(ledgerEntries)
    .where(and(...filters));
  return [...new Set(rows.map((row) => row.createdById))];
}

export async function evaluateRunClearance(
  db: AppDb,
  input: {
    tenantId: string;
    run: Pick<
      ReconciliationRunDetail,
      "runId" | "bankAccountId" | "source" | "periodStart" | "periodEnd" | "status"
    >;
    actor: ClearancePerson;
  }
): Promise<VarianceClearanceVerdict> {
  const [account] = await db
    .select({ locationId: bankAccounts.locationId })
    .from(bankAccounts)
    .where(
      and(eq(bankAccounts.id, input.run.bankAccountId), eq(bankAccounts.tenantId, input.tenantId))
    )
    .limit(1);

  const [depositsForPeriod, entitlements, paymentPosterIds] = await Promise.all([
    listDepositsForRunPeriod(db, {
      tenantId: input.tenantId,
      bankAccountId: input.run.bankAccountId,
      periodStart: input.run.periodStart,
      periodEnd: input.run.periodEnd,
    }),
    listStaffEntitlements(db, input.tenantId),
    listPaymentPosterIds(db, {
      tenantId: input.tenantId,
      periodStart: input.run.periodStart,
      periodEnd: input.run.periodEnd,
      locationId: account?.locationId ?? null,
    }),
  ]);

  return canClearVariance({
    actor: input.actor,
    run: input.run,
    depositsForPeriod,
    entitlements,
    paymentPosterIds,
  });
}

export type ClearReconciliationResult =
  | { status: "not_found" }
  | {
      status: "refused";
      clearance: VarianceClearanceVerdict;
      httpStatus: 403 | 409;
    }
  | {
      status: "cleared";
      run: ReconciliationRunDetail;
      clearance: VarianceClearanceVerdict;
    };

export async function clearReconciliationRun(
  db: AppDb,
  input: {
    tenantId: string;
    runId: string;
    actor: ClearancePerson & { displayName: string };
    now?: Date;
  }
): Promise<ClearReconciliationResult> {
  const now = input.now ?? new Date();
  const run = await getReconciliationRun(db, input.tenantId, input.runId);
  if (!run) return { status: "not_found" };

  const clearance = await evaluateRunClearance(db, {
    tenantId: input.tenantId,
    run,
    actor: input.actor,
  });

  if (!clearance.ok) {
    return {
      status: "refused",
      clearance,
      httpStatus: clearance.code === "already_cleared" ? 409 : 403,
    };
  }

  const openVariances = run.variances.filter((row) => row.status === "open");
  if (openVariances.length > 0) {
    await db
      .update(reconciliationVariances)
      .set({ status: "cleared" })
      .where(
        and(
          eq(reconciliationVariances.runId, run.runId),
          eq(reconciliationVariances.status, "open")
        )
      );
  }

  const summary: Record<string, unknown> = {
    ...run.summary,
    sourceLabel: "statement import",
    openVarianceCount: 0,
    degradedOwnerClearance: clearance.degradedOwnerClearance,
    clearedVarianceCount: openVariances.length,
  };
  if (clearance.degradedOwnerClearance) {
    summary.degradedOwnerClearanceFinding = {
      code: "degraded_owner_clearance",
      control: "runtime_sod_variance_clearance",
      recordedAt: now.toISOString(),
    };
  }

  await db
    .update(reconciliationRuns)
    .set({
      status: "cleared",
      clearedAt: now,
      clearedById: input.actor.id,
      clearedByName: input.actor.displayName,
      summary,
    })
    .where(and(eq(reconciliationRuns.id, run.runId), eq(reconciliationRuns.tenantId, input.tenantId)));

  const eventPayload: Record<string, unknown> = {
    runId: run.runId,
    source: "statement_import",
    clearedVarianceIds: openVariances.map((row) => row.varianceId),
    clearedVarianceCount: openVariances.length,
    degradedOwnerClearance: clearance.degradedOwnerClearance,
  };
  if (clearance.degradedOwnerClearance) {
    eventPayload.finding = "degraded_owner_clearance";
  }

  await appendEvent(db, input.tenantId, input.actor.id, "reconciliation.cleared", eventPayload, now);
  if (openVariances.length > 0) {
    await appendEvent(
      db,
      input.tenantId,
      input.actor.id,
      "reconciliation.variance_cleared",
      {
        runId: run.runId,
        source: "statement_import",
        varianceIds: openVariances.map((row) => row.varianceId),
        degradedOwnerClearance: clearance.degradedOwnerClearance,
      },
      new Date(now.getTime() + 1)
    );
  }

  const cleared = await getReconciliationRun(db, input.tenantId, input.runId);
  if (!cleared) return { status: "not_found" };
  return { status: "cleared", run: { ...cleared, clearance }, clearance };
}
