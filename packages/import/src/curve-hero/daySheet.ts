import { headerIndex, parseCsv, parseIsoDate, parseMoneyToCents, requireColumns, skipRow } from "../csv";
import type { DaySheetRow } from "../types";

export function parseCurveHeroDaySheet(content: string, warnings: string[] = []): DaySheetRow[] {
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
  table.slice(1).forEach((cells, i) => {
    const businessDate = parseIsoDate(cells[dateIdx] ?? "");
    const amountCents = parseMoneyToCents(cells[amountIdx] ?? "");
    if (!businessDate) return skipRow(warnings, i + 1, "date_unparseable", `invalid date "${cells[dateIdx] ?? ""}"`);
    if (amountCents === null) return skipRow(warnings, i + 1, "amount_unparseable", `invalid amount "${cells[amountIdx] ?? ""}"`);
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
  });
  return rows;
}
