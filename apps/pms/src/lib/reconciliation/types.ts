export type ReconciliationRunSummary = {
  runId: string;
  bankAccountId: string;
  bankAccountName: string;
  source: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  bankNetCents: number;
  matchedCents: number;
  varianceCents: number;
  openVarianceCount: number;
  createdAt: string;
  createdByName: string;
};

export type ReconciliationVarianceRow = {
  varianceId: string;
  kind: string;
  status: string;
  amountCents: number;
  description: string;
  postedDate: string | null;
  matchRef: Record<string, unknown> | null;
};

export type ReconciliationRunDetail = ReconciliationRunSummary & {
  variances: ReconciliationVarianceRow[];
  summary: Record<string, unknown>;
};

export type BankAccountOption = {
  bankAccountId: string;
  displayName: string;
  institutionName: string | null;
  accountNumberLast4: string | null;
};
