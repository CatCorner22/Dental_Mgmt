export type LedgerAccountSummary = {
  accountId: string;
  displayName: string;
  patientDueCents: number;
  insurancePendingCents: number;
  creditCents: number;
  patientCount: number;
};

export type LedgerPatientBalance = {
  patientId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  patientDueCents: number;
  insurancePendingCents: number;
  creditCents: number;
};

export type LedgerExplanationRow = {
  entryId: string;
  patientId: string;
  kind: string;
  amountCents: number;
  effectiveDate: string;
  postedAt: string;
  reasonCode: string | null;
  reasonLabel: string | null;
  posterName: string;
  memo: string | null;
};

export type LedgerAccountDetail = {
  accountId: string;
  displayName: string;
  patients: LedgerPatientBalance[];
  entries: LedgerExplanationRow[];
};
