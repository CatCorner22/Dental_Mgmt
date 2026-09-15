export const LEDGER_KINDS = [
  "charge",
  "patient_payment",
  "insurance_payment",
  "adjustment",
  "write_off",
  "refund",
  "transfer_out",
  "transfer_in",
  "reversal",
] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const GL_BUCKETS = [
  "patient_ar",
  "ins_ar_primary",
  "ins_ar_secondary",
  "unapplied_credit",
  "undeposited_funds",
] as const;

export type GlBucket = (typeof GL_BUCKETS)[number];

export type Tender = "cash" | "check" | "card" | "ach" | "eft";

export type LedgerEntry = {
  id: string;
  tenantId: string;
  accountId: string;
  patientId: string;
  locationId: string;
  kind: LedgerKind;
  glBucket: GlBucket;
  amountCents: number;
  currency: string;
  reasonCode?: string | null;
  effectiveDate: string;
  postedAt: string;
  createdById: string;
  createdByName: string;
  procedureId?: string | null;
  claimId?: string | null;
  coverageId?: string | null;
  reversesEntryId?: string | null;
  approvalRequestId?: string | null;
  tender?: Tender | null;
  memo?: string | null;
  idempotencyKey: string;
  insuranceExpectedCents?: number | null;
  /** Pins insurer money to specific charge rows when set. */
  chargeIds?: string[];
};

export type PaymentAllocation = {
  id: string;
  tenantId: string;
  paymentEntryId: string;
  chargeEntryId: string;
  amountCents: number;
};

export type AccountBalances = {
  patientDueCents: number;
  insurancePendingCents: number;
  creditCents: number;
};

export type PostRefusal = {
  ok: false;
  code: string;
  verb: string;
  control: string;
  why: string;
  evaluation?: unknown;
};

export type PostSuccess = {
  ok: true;
  entry: LedgerEntry;
  allocations: PaymentAllocation[];
  duplicate?: boolean;
};

export type PostResult = PostSuccess | PostRefusal;
