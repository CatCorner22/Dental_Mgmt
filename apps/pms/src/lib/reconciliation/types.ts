export type VarianceClearanceVerdict = {
  ok: boolean;
  code: string;
  verb: string;
  why: string;
  degradedOwnerClearance: boolean;
};

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
  clearedAt: string | null;
  clearedByName: string | null;
  degradedOwnerClearance: boolean;
};

export function independenceSourceLabel(source: string): string {
  if (source === "statement_import") return "statement import";
  if (source === "aggregator_feed") return "aggregator feed";
  return source.replace(/_/g, " ");
}

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
  clearance?: VarianceClearanceVerdict;
};

export type BankAccountOption = {
  bankAccountId: string;
  displayName: string;
  institutionName: string | null;
  accountNumberLast4: string | null;
};
