import { headerIndex, parseCsv, parseIsoDate, parseMoneyToCents, requireColumns } from "../csv";
import type { DaySheetRow } from "../types";

export function parseCurveHeroDaySheet(content: string): DaySheetRow[] {
  const table = parseCsv(content);
  if (table.length === 0) return [];
  const headers = table[0];
  const missing = requireColumns(headers, [
    ["Date"],
    ["Location"],
    ["Patient MRN", "MRN"],
    ["Patient Name"],
    ["Transaction Type", "Type"],
    ["Amount"],
  ]);
  if (missing.length > 0) {
    throw new Error(`Curve Hero day sheet missing columns: ${missing.join(", ")}`);
  }

  const dateIdx = headerIndex(headers, ["Date"]);
  const locationIdx = headerIndex(headers, ["Location"]);
  const mrnIdx = headerIndex(headers, ["Patient MRN", "MRN"]);
  const nameIdx = headerIndex(headers, ["Patient Name"]);
  const typeIdx = headerIndex(headers, ["Transaction Type", "Type"]);
  const amountIdx = headerIndex(headers, ["Amount"]);
  const providerIdx = headerIndex(headers, ["Provider"]);
  const descriptionIdx = headerIndex(headers, ["Description", "Memo"]);

  const rows: DaySheetRow[] = [];
  for (const cells of table.slice(1)) {
    const businessDate = parseIsoDate(cells[dateIdx] ?? "");
    const amountCents = parseMoneyToCents(cells[amountIdx] ?? "");
    if (!businessDate || amountCents === null) continue;
    rows.push({
      kind: "day_sheet",
      businessDate,
      locationCode: (cells[locationIdx] ?? "").trim(),
      patientMrn: (cells[mrnIdx] ?? "").trim(),
      patientName: (cells[nameIdx] ?? "").trim(),
      transactionType: (cells[typeIdx] ?? "").trim(),
      amountCents,
      providerCode: providerIdx >= 0 ? (cells[providerIdx] ?? "").trim() || null : null,
      description: descriptionIdx >= 0 ? (cells[descriptionIdx] ?? "").trim() || null : null,
    });
  }
  return rows;
}
