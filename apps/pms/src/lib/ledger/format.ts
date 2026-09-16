const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return USD.format(cents / 100);
}

export function formatLedgerKind(kind: string): string {
  switch (kind) {
    case "charge":
      return "Charge";
    case "patient_payment":
      return "Patient payment";
    case "insurance_payment":
      return "Insurance payment";
    case "adjustment":
      return "Adjustment";
    case "write_off":
      return "Write-off";
    case "refund":
      return "Refund";
    case "transfer_out":
      return "Transfer out";
    case "transfer_in":
      return "Transfer in";
    case "reversal":
      return "Reversal";
    default:
      return kind.replace(/_/g, " ");
  }
}
