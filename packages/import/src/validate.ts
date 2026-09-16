import { createHash } from "node:crypto";
import type {
  CurveHeroReportKind,
  CurveHeroRow,
  ImportValidationSummary,
  StagedRow,
} from "./types";

function rowSourceKey(row: CurveHeroRow): string | null {
  switch (row.kind) {
    case "day_sheet":
      return `${row.businessDate}|${row.patientMrn}|${row.transactionType}|${row.amountCents}`;
    case "ar_aging":
      return row.patientMrn;
    case "deposit_slip":
      return `${row.depositDate}|${row.locationCode}|${row.method}|${row.amountCents}|${row.reference ?? ""}`;
    case "patient_header":
      return row.patientMrn;
    case "coverage_header":
      return `${row.patientMrn}|${row.coverageRank}`;
    default:
      return null;
  }
}

function validateRow(row: CurveHeroRow): string[] {
  const errors: string[] = [];
  switch (row.kind) {
    case "day_sheet":
      if (!row.patientMrn) errors.push("patient_mrn_required");
      if (!row.locationCode) errors.push("location_required");
      if (!row.transactionType) errors.push("transaction_type_required");
      if (row.amountCents === 0) errors.push("amount_zero");
      break;
    case "ar_aging":
      if (!row.patientMrn) errors.push("patient_mrn_required");
      const bucketSum =
        row.currentCents +
        row.days30Cents +
        row.days60Cents +
        row.days90Cents +
        row.days120PlusCents;
      if (bucketSum !== row.totalCents) errors.push("aging_buckets_mismatch");
      break;
    case "deposit_slip":
      if (!row.locationCode) errors.push("location_required");
      if (!row.method) errors.push("method_required");
      if (row.amountCents <= 0) errors.push("deposit_amount_non_positive");
      break;
    case "patient_header":
      if (!row.patientMrn) errors.push("patient_mrn_required");
      if (!row.firstName) errors.push("first_name_required");
      if (!row.lastName) errors.push("last_name_required");
      if (!row.locationCode) errors.push("location_required");
      break;
    case "coverage_header":
      if (!row.patientMrn) errors.push("patient_mrn_required");
      if (!row.carrierName) errors.push("carrier_required");
      if (!row.planName) errors.push("plan_required");
      break;
  }
  return errors;
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function hashRowPayload(payload: CurveHeroRow): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

export function stageParsedRows(rows: CurveHeroRow[]): StagedRow[] {
  return rows.map((payload, index) => ({
    rowNumber: index + 1,
    sourceKey: rowSourceKey(payload),
    payload,
    validationErrors: validateRow(payload),
  }));
}

export function summarizeStagedRows(
  reportKind: CurveHeroReportKind,
  staged: StagedRow[]
): ImportValidationSummary {
  const errorCount = staged.filter((row) => row.validationErrors.length > 0).length;
  const totals: Record<string, number> = { rows: staged.length, errors: errorCount };

  if (reportKind === "day_sheet") {
    totals.amountCents = staged.reduce((sum, row) => {
      if (row.payload.kind !== "day_sheet") return sum;
      return sum + row.payload.amountCents;
    }, 0);
  }
  if (reportKind === "deposit_slip") {
    totals.amountCents = staged.reduce((sum, row) => {
      if (row.payload.kind !== "deposit_slip") return sum;
      return sum + row.payload.amountCents;
    }, 0);
  }
  if (reportKind === "ar_aging") {
    totals.totalArCents = staged.reduce((sum, row) => {
      if (row.payload.kind !== "ar_aging") return sum;
      return sum + row.payload.totalCents;
    }, 0);
  }

  return {
    rowCount: staged.length,
    errorCount,
    totals,
    status: errorCount > 0 ? "failed" : "validated",
  };
}
