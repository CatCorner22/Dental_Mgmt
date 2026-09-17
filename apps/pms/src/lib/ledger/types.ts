/**
 * Kinds the posting screen may post. Lives here, not in post.ts, because the
 * posting page is a client component: importing post.ts would pull the
 * Postgres driver into the browser bundle and break `next build`.
 */
export const POSTABLE_KINDS = ["charge", "patient_payment", "adjustment", "write_off"] as const;
export type PostableKind = (typeof POSTABLE_KINDS)[number];

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
