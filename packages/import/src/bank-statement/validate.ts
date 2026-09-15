import { createHash } from "node:crypto";
import type {
  BankStatementRow,
  BankStatementValidationSummary,
  StagedBankRow,
} from "./types";

export function bankRowExternalKey(row: BankStatementRow, rowNumber: number): string {
  const raw = `${row.postedDate}|${row.description}|${row.amountCents}|${row.reference ?? ""}|${rowNumber}`;
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 32);
}

function validateRow(row: BankStatementRow): string[] {
  const errors: string[] = [];
  if (!row.postedDate) errors.push("posted_date_required");
  if (!row.description) errors.push("description_required");
  if (row.amountCents === 0) errors.push("amount_zero");
  return errors;
}

export function stageBankRows(rows: BankStatementRow[]): StagedBankRow[] {
  return rows.map((payload, index) => {
    const rowNumber = index + 1;
    return {
      rowNumber,
      externalKey: bankRowExternalKey(payload, rowNumber),
      payload,
      validationErrors: validateRow(payload),
    };
  });
}

export function summarizeBankRows(staged: StagedBankRow[]): BankStatementValidationSummary {
  const valid = staged.filter((row) => row.validationErrors.length === 0);
  const errorCount = staged.length - valid.length;
  let creditCents = 0;
  let debitCents = 0;
  const dates: string[] = [];

  for (const row of valid) {
    dates.push(row.payload.postedDate);
    if (row.payload.amountCents > 0) creditCents += row.payload.amountCents;
    else debitCents += Math.abs(row.payload.amountCents);
  }

  dates.sort();
  return {
    rowCount: staged.length,
    errorCount,
    periodStart: dates[0] ?? null,
    periodEnd: dates.at(-1) ?? null,
    totals: {
      creditCents,
      debitCents,
      netCents: creditCents - debitCents,
    },
    status: errorCount > 0 ? "failed" : "validated",
  };
}
