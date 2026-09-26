import { headerIndex, parseCsv, parseIsoDate, parseMoneyToCents, requireColumns, skipRow } from "../csv";
import type { DepositSlipRow } from "../types";

export function parseCurveHeroDepositSlip(content: string, warnings: string[] = []): DepositSlipRow[] {
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
  table.slice(1).forEach((cells, i) => {
    const depositDate = parseIsoDate(cells[dateIdx] ?? "");
    const amountCents = parseMoneyToCents(cells[amountIdx] ?? "");
    if (!depositDate) return skipRow(warnings, i + 1, "date_unparseable", `invalid date "${cells[dateIdx] ?? ""}"`);
    if (amountCents === null) return skipRow(warnings, i + 1, "amount_unparseable", `invalid amount "${cells[amountIdx] ?? ""}"`);
    rows.push({
      kind: "deposit_slip",
      depositDate,
      locationCode: (cells[locationIdx] ?? "").trim(),
      method: (cells[methodIdx] ?? "").trim(),
      amountCents,
      reference: referenceIdx >= 0 ? (cells[referenceIdx] ?? "").trim() || null : null,
    });
  });
  return rows;
}
