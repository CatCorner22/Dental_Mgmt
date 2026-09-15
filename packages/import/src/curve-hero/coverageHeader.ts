import { headerIndex, parseCsv, requireColumns } from "../csv";
import type { CoverageHeaderRow } from "../types";

function parseCoverageRank(raw: string): 1 | 2 | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "primary" || normalized === "pri") return 1;
  if (normalized === "2" || normalized === "secondary" || normalized === "sec") return 2;
  return null;
}

export function parseCurveHeroCoverageHeader(content: string): CoverageHeaderRow[] {
  const table = parseCsv(content);
  if (table.length === 0) return [];
  const headers = table[0];
  const missing = requireColumns(headers, [
    ["Patient MRN", "MRN"],
    ["Carrier"],
    ["Plan"],
    ["Rank", "Coverage Rank"],
  ]);
  if (missing.length > 0) {
    throw new Error(`Curve Hero coverage header missing columns: ${missing.join(", ")}`);
  }

  const mrnIdx = headerIndex(headers, ["Patient MRN", "MRN"]);
  const carrierIdx = headerIndex(headers, ["Carrier"]);
  const planIdx = headerIndex(headers, ["Plan"]);
  const memberIdx = headerIndex(headers, ["Member ID", "Subscriber ID"]);
  const rankIdx = headerIndex(headers, ["Rank", "Coverage Rank"]);

  const rows: CoverageHeaderRow[] = [];
  for (const cells of table.slice(1)) {
    const patientMrn = (cells[mrnIdx] ?? "").trim();
    const coverageRank = parseCoverageRank(cells[rankIdx] ?? "");
    if (!patientMrn || !coverageRank) continue;
    rows.push({
      kind: "coverage_header",
      patientMrn,
      carrierName: (cells[carrierIdx] ?? "").trim(),
      planName: (cells[planIdx] ?? "").trim(),
      memberId: memberIdx >= 0 ? (cells[memberIdx] ?? "").trim() || null : null,
      coverageRank,
    });
  }
  return rows;
}
