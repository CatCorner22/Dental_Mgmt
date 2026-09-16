import type { LedgerAccountDetail, LedgerExplanationRow, LedgerPatientBalance } from "../ledger/types";

export type StatementStatus = "draft" | "issued" | "held" | "void";

export type StatementTotals = {
  patientDueCents: number;
  insurancePendingCents: number;
  creditCents: number;
};

export type StatementSnapshot = {
  displayName: string;
  asOf: string;
  patients: LedgerPatientBalance[];
  lines: LedgerExplanationRow[];
  totals: StatementTotals;
};

export type StatementRecord = {
  id: string;
  accountId: string;
  patientId: string | null;
  displayName: string;
  asOf: string;
  status: StatementStatus;
  patientDueCents: number;
  insurancePendingCents: number;
  creditCents: number;
  holdReason: string | null;
  snapshot: StatementSnapshot;
  issuedAt: string | null;
  issuedByName: string | null;
  createdAt: string;
};

export function statementTotalsFromDetail(detail: LedgerAccountDetail): StatementTotals {
  return detail.patients.reduce(
    (sum, patient) => ({
      patientDueCents: sum.patientDueCents + patient.patientDueCents,
      insurancePendingCents: sum.insurancePendingCents + patient.insurancePendingCents,
      creditCents: sum.creditCents + patient.creditCents,
    }),
    { patientDueCents: 0, insurancePendingCents: 0, creditCents: 0 }
  );
}

export function buildStatementSnapshot(
  detail: LedgerAccountDetail,
  asOf: string,
  patientId?: string | null
): StatementSnapshot {
  const patients = patientId
    ? detail.patients.filter((patient) => patient.patientId === patientId)
    : detail.patients;
  const lines = patientId
    ? detail.entries.filter((entry) => entry.patientId === patientId)
    : detail.entries;
  const scoped: LedgerAccountDetail = {
    accountId: detail.accountId,
    displayName: detail.displayName,
    patients,
    entries: lines,
  };
  return {
    displayName: detail.displayName,
    asOf,
    patients,
    lines,
    totals: statementTotalsFromDetail(scoped),
  };
}

export function issueRefusal(
  status: StatementStatus,
  holdReason: string | null,
  accountHeld: boolean
): "already_issued" | "held" | "void" | null {
  if (status === "issued") return "already_issued";
  if (status === "void") return "void";
  if (status === "held" || (holdReason && holdReason.trim().length > 0) || accountHeld) {
    return "held";
  }
  return null;
}
