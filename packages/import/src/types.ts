export const CURVE_HERO_REPORT_KINDS = [
  "day_sheet",
  "ar_aging",
  "deposit_slip",
  "patient_header",
  "coverage_header",
] as const;

export type CurveHeroReportKind = (typeof CURVE_HERO_REPORT_KINDS)[number];

export type CurveHeroSourceSystem = "curve_hero";

export type DaySheetRow = {
  kind: "day_sheet";
  businessDate: string;
  locationCode: string;
  patientMrn: string;
  patientName: string;
  transactionType: string;
  amountCents: number;
  providerCode: string | null;
  description: string | null;
};

export type ArAgingRow = {
  kind: "ar_aging";
  patientMrn: string;
  patientName: string;
  currentCents: number;
  days30Cents: number;
  days60Cents: number;
  days90Cents: number;
  days120PlusCents: number;
  totalCents: number;
};

export type DepositSlipRow = {
  kind: "deposit_slip";
  depositDate: string;
  locationCode: string;
  method: string;
  amountCents: number;
  reference: string | null;
};

export type PatientHeaderRow = {
  kind: "patient_header";
  patientMrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  locationCode: string;
  guarantorName: string | null;
};

export type CoverageHeaderRow = {
  kind: "coverage_header";
  patientMrn: string;
  carrierName: string;
  planName: string;
  memberId: string | null;
  coverageRank: 1 | 2;
};

export type CurveHeroRow =
  | DaySheetRow
  | ArAgingRow
  | DepositSlipRow
  | PatientHeaderRow
  | CoverageHeaderRow;

export type ParsedCurveHeroReport = {
  sourceSystem: CurveHeroSourceSystem;
  reportKind: CurveHeroReportKind;
  rows: CurveHeroRow[];
  warnings: string[];
};

export type StagedRow = {
  rowNumber: number;
  sourceKey: string | null;
  payload: CurveHeroRow;
  validationErrors: string[];
};

export type ImportValidationSummary = {
  rowCount: number;
  errorCount: number;
  totals: Record<string, number>;
  status: "validated" | "failed";
};
