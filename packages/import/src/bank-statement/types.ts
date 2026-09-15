export type BankStatementFormat = "csv";

export type BankStatementRow = {
  postedDate: string;
  description: string;
  amountCents: number;
  reference: string | null;
  balanceCents: number | null;
};

export type StagedBankRow = {
  rowNumber: number;
  externalKey: string;
  payload: BankStatementRow;
  validationErrors: string[];
};

export type BankStatementValidationSummary = {
  rowCount: number;
  errorCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  totals: {
    creditCents: number;
    debitCents: number;
    netCents: number;
  };
  status: "validated" | "failed";
};

export type ParsedBankStatement = {
  format: BankStatementFormat;
  rows: BankStatementRow[];
  warnings: string[];
};
