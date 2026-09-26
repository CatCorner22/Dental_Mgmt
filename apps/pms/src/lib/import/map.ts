import type { DaySheetRow } from "@pms/import";
import type { GlBucket, LedgerKind } from "@pms/ledger";

export type DaySheetLedgerMapping = {
  kind: Extract<LedgerKind, "charge" | "patient_payment">;
  amountCents: number;
  glBucket: GlBucket;
};

/** Maps Curve Hero transaction labels to ledger kinds. */
export function mapDaySheetTransaction(
  transactionType: string
): DaySheetLedgerMapping["kind"] | null {
  const normalized = transactionType.trim().toLowerCase();
  if (/charge|production|fee/.test(normalized)) return "charge";
  if (/payment|pay|copay/.test(normalized)) return "patient_payment";
  return null;
}

/** Charges are positive; patient payments are negative cents. */
export function mapDaySheetAmount(
  kind: DaySheetLedgerMapping["kind"],
  amountCents: number
): number {
  const magnitude = Math.abs(amountCents);
  return kind === "charge" ? magnitude : -magnitude;
}

export function mapDaySheetRow(row: DaySheetRow): DaySheetLedgerMapping | null {
  const kind = mapDaySheetTransaction(row.transactionType);
  if (!kind) return null;
  return {
    kind,
    amountCents: mapDaySheetAmount(kind, row.amountCents),
    glBucket: "patient_ar",
  };
}

export function importCurveIdempotencyKey(runId: string, rowNumber: number): string {
  return `import:curve:${runId}:${rowNumber}`;
}

/**
 * Names a posting by the file it came from and the line in that file, so the
 * same export staged into a second run posts nothing new, while a different
 * export with an identical line still posts.
 */
export function importCurveRowIdempotencyKey(fileSha256: string, rowNumber: number): string {
  return `import:curve:file:${fileSha256}:${rowNumber}`;
}
