import { headerIndex, parseCsv, parseIsoDate, parseMoneyToCents, requireColumns } from "../csv";
import type { DepositSlipRow } from "../types";

export function parseCurveHeroDepositSlip(content: string): DepositSlipRow[] {
  const table = parseCsv(content);
  if (table.length === 0) return [];
  const headers = table[0];
  const missing = requireColumns(headers, [
    ["Deposit Date", "Date"],
    ["Location"],
    ["Method", "Tender"],
    ["Amount"],
  ]);
  if (missing.length > 0) {
    throw new Error(`Curve Hero deposit slip missing columns: ${missing.join(", ")}`);
  }

  const dateIdx = headerIndex(headers, ["Deposit Date", "Date"]);
  const locationIdx = headerIndex(headers, ["Location"]);
  const methodIdx = headerIndex(headers, ["Method", "Tender"]);
  const amountIdx = headerIndex(headers, ["Amount"]);
  const referenceIdx = headerIndex(headers, ["Reference", "Check #", "Check Number"]);

  const rows: DepositSlipRow[] = [];
  for (const cells of table.slice(1)) {
    const depositDate = parseIsoDate(cells[dateIdx] ?? "");
    const amountCents = parseMoneyToCents(cells[amountIdx] ?? "");
    if (!depositDate || amountCents === null) continue;
    rows.push({
      kind: "deposit_slip",
      depositDate,
      locationCode: (cells[locationIdx] ?? "").trim(),
      method: (cells[methodIdx] ?? "").trim(),
      amountCents,
      reference: referenceIdx >= 0 ? (cells[referenceIdx] ?? "").trim() || null : null,
    });
  }
  return rows;
}
