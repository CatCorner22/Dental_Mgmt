import { headerIndex, parseCsv, parseMoneyToCents, requireColumns } from "../csv";
import type { ArAgingRow } from "../types";

export function parseCurveHeroArAging(content: string): ArAgingRow[] {
  const table = parseCsv(content);
  if (table.length === 0) return [];
  const headers = table[0];
  const missing = requireColumns(headers, [
    ["Patient MRN", "MRN"],
    ["Patient Name"],
    ["Current"],
    ["30"],
    ["60"],
    ["90"],
    ["120+"],
    ["Total"],
  ]);
  if (missing.length > 0) {
    throw new Error(`Curve Hero AR aging missing columns: ${missing.join(", ")}`);
  }

  const mrnIdx = headerIndex(headers, ["Patient MRN", "MRN"]);
  const nameIdx = headerIndex(headers, ["Patient Name"]);
  const currentIdx = headerIndex(headers, ["Current"]);
  const d30Idx = headerIndex(headers, ["30"]);
  const d60Idx = headerIndex(headers, ["60"]);
  const d90Idx = headerIndex(headers, ["90"]);
  const d120Idx = headerIndex(headers, ["120+"]);
  const totalIdx = headerIndex(headers, ["Total"]);

  const rows: ArAgingRow[] = [];
  for (const cells of table.slice(1)) {
    const patientMrn = (cells[mrnIdx] ?? "").trim();
    if (!patientMrn) continue;
    const currentCents = parseMoneyToCents(cells[currentIdx] ?? "") ?? 0;
    const days30Cents = parseMoneyToCents(cells[d30Idx] ?? "") ?? 0;
    const days60Cents = parseMoneyToCents(cells[d60Idx] ?? "") ?? 0;
    const days90Cents = parseMoneyToCents(cells[d90Idx] ?? "") ?? 0;
    const days120PlusCents = parseMoneyToCents(cells[d120Idx] ?? "") ?? 0;
    const totalCents = parseMoneyToCents(cells[totalIdx] ?? "");
    rows.push({
      kind: "ar_aging",
      patientMrn,
      patientName: (cells[nameIdx] ?? "").trim(),
      currentCents,
      days30Cents,
      days60Cents,
      days90Cents,
      days120PlusCents,
      totalCents: totalCents ?? currentCents + days30Cents + days60Cents + days90Cents + days120PlusCents,
    });
  }
  return rows;
}
