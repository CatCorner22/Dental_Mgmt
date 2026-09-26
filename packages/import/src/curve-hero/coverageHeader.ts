import { headerIndex, parseCsv, requireColumns, skipRow } from "../csv";
import type { CoverageHeaderRow } from "../types";

function parseCoverageRank(raw: string): 1 | 2 | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "primary" || normalized === "pri") return 1;
  if (normalized === "2" || normalized === "secondary" || normalized === "sec") return 2;
  return null;
}

export function parseCurveHeroCoverageHeader(content: string, warnings: string[] = []): CoverageHeaderRow[] {
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
  table.slice(1).forEach((cells, i) => {
    const patientMrn = (cells[mrnIdx] ?? "").trim();
    const coverageRank = parseCoverageRank(cells[rankIdx] ?? "");
    if (!patientMrn) return skipRow(warnings, i + 1, "patient_mrn_required", "blank patient MRN");
    if (!coverageRank) return skipRow(warnings, i + 1, "coverage_rank_unparseable", `invalid coverage rank "${cells[rankIdx] ?? ""}"`);
    rows.push({
      kind: "coverage_header",
      patientMrn,
      carrierName: (cells[carrierIdx] ?? "").trim(),
      planName: (cells[planIdx] ?? "").trim(),
      memberId: memberIdx >= 0 ? (cells[memberIdx] ?? "").trim() || null : null,
      coverageRank,
    });
  });
  return rows;
}
