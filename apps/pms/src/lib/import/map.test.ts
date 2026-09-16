import { describe, expect, it } from "vitest";
import {
  importCurveIdempotencyKey,
  mapDaySheetAmount,
  mapDaySheetRow,
  mapDaySheetTransaction,
} from "./map";

describe("mapDaySheetTransaction", () => {
  it("maps charges and payments", () => {
    expect(mapDaySheetTransaction("Charge")).toBe("charge");
    expect(mapDaySheetTransaction("Production")).toBe("charge");
    expect(mapDaySheetTransaction("Payment")).toBe("patient_payment");
    expect(mapDaySheetTransaction("Patient copay")).toBe("patient_payment");
  });

  it("returns null for unsupported types", () => {
    expect(mapDaySheetTransaction("Adjustment")).toBeNull();
    expect(mapDaySheetTransaction("")).toBeNull();
  });
});

describe("mapDaySheetAmount", () => {
  it("normalizes sign by ledger kind", () => {
    expect(mapDaySheetAmount("charge", 24500)).toBe(24500);
    expect(mapDaySheetAmount("charge", -24500)).toBe(24500);
    expect(mapDaySheetAmount("patient_payment", -10000)).toBe(-10000);
    expect(mapDaySheetAmount("patient_payment", 10000)).toBe(-10000);
  });
});

describe("mapDaySheetRow", () => {
  it("maps a day sheet row fixture shape", () => {
    const mapped = mapDaySheetRow({
      kind: "day_sheet",
      businessDate: "2026-09-14",
      locationCode: "MAIN",
      patientMrn: "CH-10042",
      patientName: "Jane Doe",
      transactionType: "Charge",
      amountCents: 24500,
      providerCode: "DR-SMITH",
      description: "D2391 composite",
    });
    expect(mapped).toEqual({
      kind: "charge",
      amountCents: 24500,
      glBucket: "patient_ar",
    });
  });

  it("maps payments as negative patient_payment", () => {
    const mapped = mapDaySheetRow({
      kind: "day_sheet",
      businessDate: "2026-09-14",
      locationCode: "MAIN",
      patientMrn: "CH-10042",
      patientName: "Jane Doe",
      transactionType: "Payment",
      amountCents: -10000,
      providerCode: null,
      description: "Patient copay",
    });
    expect(mapped).toEqual({
      kind: "patient_payment",
      amountCents: -10000,
      glBucket: "patient_ar",
    });
  });
});

describe("importCurveIdempotencyKey", () => {
  it("ties keys to import run and row number", () => {
    expect(importCurveIdempotencyKey("run-abc", 3)).toBe("import:curve:run-abc:3");
  });
});
