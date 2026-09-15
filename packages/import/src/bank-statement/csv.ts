import { headerIndex, parseCsv, parseIsoDate, parseMoneyToCents, requireColumns } from "../csv";
import type { BankStatementRow } from "./types";

export function parseBankStatementCsv(content: string): BankStatementRow[] {
  const table = parseCsv(content);
  if (table.length === 0) return [];
  const headers = table[0];
  const missing = requireColumns(headers, [
    ["Date", "Posting Date", "Post Date"],
    ["Description", "Memo", "Payee"],
  ]);
  if (missing.length > 0) {
    throw new Error(`Bank statement CSV missing columns: ${missing.join(", ")}`);
  }

  const dateIdx = headerIndex(headers, ["Date", "Posting Date", "Post Date"]);
  const descriptionIdx = headerIndex(headers, ["Description", "Memo", "Payee"]);
  const amountIdx = headerIndex(headers, ["Amount"]);
  const debitIdx = headerIndex(headers, ["Debit", "Withdrawal"]);
  const creditIdx = headerIndex(headers, ["Credit", "Deposit"]);
  const balanceIdx = headerIndex(headers, ["Balance", "Running Balance"]);
  const referenceIdx = headerIndex(headers, ["Reference", "Check #", "Check Number", "Ref"]);

  if (amountIdx < 0 && debitIdx < 0 && creditIdx < 0) {
    throw new Error("Bank statement CSV requires Amount or Debit/Credit columns.");
  }

  const rows: BankStatementRow[] = [];
  for (const cells of table.slice(1)) {
    const postedDate = parseIsoDate(cells[dateIdx] ?? "");
    const description = (cells[descriptionIdx] ?? "").trim();
    if (!postedDate || !description) continue;

    let amountCents: number | null = null;
    if (amountIdx >= 0) {
      amountCents = parseMoneyToCents(cells[amountIdx] ?? "");
    } else {
      const debitCents = parseMoneyToCents(cells[debitIdx] ?? "") ?? 0;
      const creditCents = parseMoneyToCents(cells[creditIdx] ?? "") ?? 0;
      if (debitCents !== 0 && creditCents !== 0) continue;
      if (debitCents !== 0) amountCents = -Math.abs(debitCents);
      else if (creditCents !== 0) amountCents = Math.abs(creditCents);
      else continue;
    }
    if (amountCents === null) continue;

    const balanceCents =
      balanceIdx >= 0 ? parseMoneyToCents(cells[balanceIdx] ?? "") : null;
    rows.push({
      postedDate,
      description,
      amountCents,
      reference: referenceIdx >= 0 ? (cells[referenceIdx] ?? "").trim() || null : null,
      balanceCents,
    });
  }
  return rows;
}
