import { describe, expect, it } from "vitest";
import { formatCents, formatLedgerKind } from "./format";

describe("ledger format helpers", () => {
  it("formats cents as USD", () => {
    expect(formatCents(14500)).toBe("$145.00");
    expect(formatCents(-10000)).toBe("-$100.00");
  });

  it("labels ledger kinds for staff", () => {
    expect(formatLedgerKind("patient_payment")).toBe("Patient payment");
    expect(formatLedgerKind("write_off")).toBe("Write-off");
  });
});
