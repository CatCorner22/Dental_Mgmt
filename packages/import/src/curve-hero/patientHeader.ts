import { headerIndex, parseCsv, parseIsoDate, requireColumns } from "../csv";
import type { PatientHeaderRow } from "../types";

export function parseCurveHeroPatientHeader(content: string): PatientHeaderRow[] {
  const table = parseCsv(content);
  if (table.length === 0) return [];
  const headers = table[0];
  const missing = requireColumns(headers, [
    ["Patient MRN", "MRN"],
    ["First Name"],
    ["Last Name"],
    ["DOB", "Date of Birth"],
    ["Location"],
  ]);
  if (missing.length > 0) {
    throw new Error(`Curve Hero patient header missing columns: ${missing.join(", ")}`);
  }

  const mrnIdx = headerIndex(headers, ["Patient MRN", "MRN"]);
  const firstIdx = headerIndex(headers, ["First Name"]);
  const lastIdx = headerIndex(headers, ["Last Name"]);
  const dobIdx = headerIndex(headers, ["DOB", "Date of Birth"]);
  const locationIdx = headerIndex(headers, ["Location"]);
  const guarantorIdx = headerIndex(headers, ["Guarantor Name", "Guarantor"]);

  const rows: PatientHeaderRow[] = [];
  for (const cells of table.slice(1)) {
    const patientMrn = (cells[mrnIdx] ?? "").trim();
    const dateOfBirth = parseIsoDate(cells[dobIdx] ?? "");
    if (!patientMrn || !dateOfBirth) continue;
    rows.push({
      kind: "patient_header",
      patientMrn,
      firstName: (cells[firstIdx] ?? "").trim(),
      lastName: (cells[lastIdx] ?? "").trim(),
      dateOfBirth,
      locationCode: (cells[locationIdx] ?? "").trim(),
      guarantorName: guarantorIdx >= 0 ? (cells[guarantorIdx] ?? "").trim() || null : null,
    });
  }
  return rows;
}
