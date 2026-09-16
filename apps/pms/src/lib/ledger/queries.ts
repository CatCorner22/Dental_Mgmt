import { allocatePatientLedger } from "@pms/ledger";
import type { LedgerEntry, PaymentAllocation } from "@pms/ledger";
import { sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import type {
  LedgerAccountDetail,
  LedgerAccountSummary,
  LedgerExplanationRow,
  LedgerPatientBalance,
} from "./types";

type BalanceRow = {
  account_id: string;
  display_name: string;
  patient_id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  patient_ar_net_cents: string | number | null;
  insurance_pending_cents: string | number | null;
  unapplied_credit_cents: string | number | null;
};

function cents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export async function listLedgerAccounts(db: AppDb, tenantId: string): Promise<LedgerAccountSummary[]> {
  const result = await db.execute<BalanceRow>(sql`
    SELECT
      ga.id AS account_id,
      ga.display_name,
      p.id AS patient_id,
      p.mrn,
      p.first_name,
      p.last_name,
      ab.patient_ar_net_cents,
      ab.insurance_pending_cents,
      ab.unapplied_credit_cents
    FROM guarantor_accounts ga
    JOIN account_members am
      ON am.account_id = ga.id
     AND am.tenant_id = ga.tenant_id
     AND am.effective_to IS NULL
    JOIN patients p ON p.id = am.patient_id AND p.tenant_id = ga.tenant_id
    LEFT JOIN account_balances ab
      ON ab.account_id = ga.id
     AND ab.patient_id = p.id
     AND ab.tenant_id = ga.tenant_id
    WHERE ga.tenant_id = ${tenantId}
    ORDER BY ga.display_name, p.last_name, p.first_name
  `);

  const rows = result.rows as BalanceRow[];
  const byAccount = new Map<string, LedgerAccountSummary>();

  for (const row of rows) {
    const existing = byAccount.get(row.account_id);
    const patientDue = cents(row.patient_ar_net_cents);
    const insurancePending = cents(row.insurance_pending_cents);
    const credit = cents(row.unapplied_credit_cents);
    if (!existing) {
      byAccount.set(row.account_id, {
        accountId: row.account_id,
        displayName: row.display_name,
        patientDueCents: patientDue,
        insurancePendingCents: insurancePending,
        creditCents: credit,
        patientCount: 1,
      });
      continue;
    }
    existing.patientDueCents += patientDue;
    existing.insurancePendingCents += insurancePending;
    existing.creditCents += credit;
    existing.patientCount += 1;
  }

  return [...byAccount.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function mapEntry(row: Record<string, unknown>): LedgerEntry {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    accountId: String(row.account_id),
    patientId: String(row.patient_id),
    locationId: String(row.location_id),
    kind: String(row.kind) as LedgerEntry["kind"],
    glBucket: String(row.gl_bucket) as LedgerEntry["glBucket"],
    amountCents: Number(row.amount_cents),
    currency: String(row.currency ?? "USD"),
    reasonCode: row.reason_code ? String(row.reason_code) : null,
    effectiveDate: String(row.effective_date).slice(0, 10),
    postedAt: new Date(String(row.posted_at)).toISOString(),
    createdById: String(row.created_by_id),
    createdByName: String(row.created_by_name),
    procedureId: row.procedure_id ? String(row.procedure_id) : null,
    claimId: row.claim_id ? String(row.claim_id) : null,
    coverageId: row.coverage_id ? String(row.coverage_id) : null,
    reversesEntryId: row.reverses_entry_id ? String(row.reverses_entry_id) : null,
    approvalRequestId: row.approval_request_id ? String(row.approval_request_id) : null,
    tender: row.tender ? (String(row.tender) as LedgerEntry["tender"]) : null,
    memo: row.memo ? String(row.memo) : null,
    idempotencyKey: String(row.idempotency_key),
    insuranceExpectedCents:
      row.insurance_expected_cents === null || row.insurance_expected_cents === undefined
        ? null
        : Number(row.insurance_expected_cents),
  };
}

export async function getLedgerAccountDetail(
  db: AppDb,
  tenantId: string,
  accountId: string
): Promise<LedgerAccountDetail | null> {
  const accountResult = await db.execute<{ id: string; display_name: string }>(sql`
    SELECT id, display_name
    FROM guarantor_accounts
    WHERE tenant_id = ${tenantId} AND id = ${accountId}
    LIMIT 1
  `);
  const account = accountResult.rows[0];
  if (!account) return null;

  const patientResult = await db.execute<BalanceRow>(sql`
    SELECT
      ga.id AS account_id,
      ga.display_name,
      p.id AS patient_id,
      p.mrn,
      p.first_name,
      p.last_name,
      ab.patient_ar_net_cents,
      ab.insurance_pending_cents,
      ab.unapplied_credit_cents
    FROM guarantor_accounts ga
    JOIN account_members am
      ON am.account_id = ga.id
     AND am.tenant_id = ga.tenant_id
     AND am.effective_to IS NULL
    JOIN patients p ON p.id = am.patient_id AND p.tenant_id = ga.tenant_id
    LEFT JOIN account_balances ab
      ON ab.account_id = ga.id
     AND ab.patient_id = p.id
     AND ab.tenant_id = ga.tenant_id
    WHERE ga.tenant_id = ${tenantId}
      AND ga.id = ${accountId}
    ORDER BY p.last_name, p.first_name
  `);

  const entriesResult = await db.execute(sql`
    SELECT
      entry_id,
      patient_id,
      kind,
      amount_cents,
      effective_date,
      posted_at,
      reason_code,
      reason_label,
      poster_name,
      memo
    FROM ledger_explanations
    WHERE tenant_id = ${tenantId}
      AND account_id = ${accountId}
    ORDER BY effective_date DESC, posted_at DESC
  `);

  const rawEntries = await db.execute(sql`
    SELECT *
    FROM ledger_entries
    WHERE tenant_id = ${tenantId}
      AND account_id = ${accountId}
    ORDER BY effective_date, id
  `);

  const allocationsResult = await db.execute(sql`
    SELECT pa.*
    FROM payment_allocations pa
    JOIN ledger_entries le ON le.id = pa.payment_entry_id
    WHERE pa.tenant_id = ${tenantId}
      AND le.account_id = ${accountId}
  `);

  const entries = rawEntries.rows.map((row) => mapEntry(row as Record<string, unknown>));
  const allocations: PaymentAllocation[] = allocationsResult.rows.map((row) => ({
    id: String((row as Record<string, unknown>).id),
    tenantId: String((row as Record<string, unknown>).tenant_id),
    paymentEntryId: String((row as Record<string, unknown>).payment_entry_id),
    chargeEntryId: String((row as Record<string, unknown>).charge_entry_id),
    amountCents: Number((row as Record<string, unknown>).amount_cents),
  }));

  const patients: LedgerPatientBalance[] = (patientResult.rows as BalanceRow[]).map((row) => {
    const patientEntries = entries.filter((e) => e.patientId === row.patient_id);
    const balances = allocatePatientLedger(row.patient_id, patientEntries, allocations).balances;
    return {
      patientId: row.patient_id,
      mrn: row.mrn,
      firstName: row.first_name,
      lastName: row.last_name,
      patientDueCents: balances.patientDueCents,
      insurancePendingCents: balances.insurancePendingCents,
      creditCents: balances.creditCents,
    };
  });

  const explanationRows: LedgerExplanationRow[] = entriesResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      entryId: String(r.entry_id),
      patientId: String(r.patient_id),
      kind: String(r.kind),
      amountCents: Number(r.amount_cents),
      effectiveDate: String(r.effective_date).slice(0, 10),
      postedAt: new Date(String(r.posted_at)).toISOString(),
      reasonCode: r.reason_code ? String(r.reason_code) : null,
      reasonLabel: r.reason_label ? String(r.reason_label) : null,
      posterName: String(r.poster_name),
      memo: r.memo ? String(r.memo) : null,
    };
  });

  return {
    accountId: account.id,
    displayName: account.display_name,
    patients,
    entries: explanationRows,
  };
}

export async function listPatientIdsForTenant(db: AppDb, tenantId: string): Promise<string[]> {
  const result = await db.execute<{ id: string }>(sql`
    SELECT id FROM patients WHERE tenant_id = ${tenantId}
  `);
  return result.rows.map((row) => row.id);
}

export async function listPatientProcedures(
  db: AppDb,
  tenantId: string,
  patientId: string
): Promise<{ id: string; label: string }[]> {
  const result = await db.execute<{ id: string; cdt_code: string; description: string }>(sql`
    SELECT id, cdt_code, description
    FROM procedures
    WHERE tenant_id = ${tenantId}
      AND patient_id = ${patientId}
    ORDER BY description
  `);
  return result.rows.map((row) => ({
    id: row.id,
    label: `${row.cdt_code} — ${row.description}`,
  }));
}
