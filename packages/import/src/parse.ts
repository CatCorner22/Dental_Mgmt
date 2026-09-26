import { parseCurveHeroArAging } from "./curve-hero/arAging";
import { parseCurveHeroCoverageHeader } from "./curve-hero/coverageHeader";
import { parseCurveHeroDaySheet } from "./curve-hero/daySheet";
import { parseCurveHeroDepositSlip } from "./curve-hero/depositSlip";
import { parseCurveHeroPatientHeader } from "./curve-hero/patientHeader";
import type { CurveHeroReportKind, CurveHeroRow, ParsedCurveHeroReport } from "./types";

export function parseCurveHeroReport(
  reportKind: CurveHeroReportKind,
  content: string
): ParsedCurveHeroReport {
  const warnings: string[] = [];
  let rows: CurveHeroRow[];

  switch (reportKind) {
    case "day_sheet":
      rows = parseCurveHeroDaySheet(content, warnings);
      break;
    case "ar_aging":
      rows = parseCurveHeroArAging(content, warnings);
      break;
    case "deposit_slip":
      rows = parseCurveHeroDepositSlip(content, warnings);
      break;
    case "patient_header":
      rows = parseCurveHeroPatientHeader(content, warnings);
      break;
    case "coverage_header":
      rows = parseCurveHeroCoverageHeader(content, warnings);
      break;
    default:
      throw new Error(`Unsupported Curve Hero report kind: ${reportKind}`);
  }

  if (rows.length === 0) warnings.push("No data rows parsed from file.");
  return { sourceSystem: "curve_hero", reportKind, rows, warnings };
}
