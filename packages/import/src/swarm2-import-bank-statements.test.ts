import { describe, expect, it } from "vitest";
import { parseIsoDate, parseMoneyToCents } from "./csv";
import { parseBankStatementCsv } from "./bank-statement/csv";
import { parseCurveHeroReport } from "./parse";

/**
 * Swarm 2, lens import-bank-statements (verified set): hostile money/date
 * parsing in the shared parser every Curve Hero report and bank statement
 * goes through. Each test asserts the correct behaviour and fails on the
 * reference commit; the failing assertion is the measured breach.
 */

describe("S2 import-bank-statements: shared CSV / money / date parser", () => {
  // Negative control: "-5.00", "-150.00", "(5.50)" and "5.50" parse correctly on the reference commit.
  it("S2-import-bank-statements-1: a signed negative amount with cents keeps its sign for the whole value", () => {
    expect(parseMoneyToCents("-5.50")).toBe(-550);
    expect(parseMoneyToCents("-0.50")).toBe(-50);
    expect(parseMoneyToCents("-150.50")).toBe(-15050);
    expect(parseMoneyToCents("-$1,234.56")).toBe(-123456);
    // The bank statement path inherits the defect: a 50-cent fee lands as a 50-cent credit.
    const csv = "Date,Description,Amount\n2026-09-13,ACH FEE,-0.50\n2026-09-13,ACH FEE,-5.50\n";
    expect(parseBankStatementCsv(csv).map((r) => r.amountCents)).toEqual([-50, -550]);
  });

  // Negative control: "abc", "5.123", "1.2.3" and "Infinity" are already rejected (null) on the reference commit.
  it("S2-import-bank-statements-2: exponent, hexadecimal, binary and octal money notations are rejected", () => {
    expect(parseMoneyToCents("1e3")).toBeNull();
    expect(parseMoneyToCents("1E+05")).toBeNull();
    expect(parseMoneyToCents("1e-2")).toBeNull();
    expect(parseMoneyToCents("0x10")).toBeNull();
    expect(parseMoneyToCents("0b11")).toBeNull();
    expect(parseMoneyToCents("0o17")).toBeNull();
  });

  // Negative control: "2026-09-12", "9/12/2026" parse to 2026-09-12 and "12-09-2026" is rejected on the reference commit.
  it("S2-import-bank-statements-3: impossible calendar dates are rejected instead of passed through", () => {
    expect(parseIsoDate("2026-13-45")).toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("99/99/2026")).toBeNull();
    expect(parseIsoDate("2026-00-10")).toBeNull();
  });

  // Negative control: a day sheet with three well-formed rows parses to three rows and no warnings on the reference commit.
  it("S2-import-bank-statements-6: a day sheet row whose amount or date cannot be parsed is surfaced, not silently dropped", () => {
    const csv = [
      "Date,Location,Patient MRN,Patient Name,Transaction Type,Amount",
      "2026-09-12,Main,MRN-1,Pat One,Payment,150.00",
      "2026-09-12,Main,MRN-2,Pat Two,Payment,N/A",
      "not-a-date,Main,MRN-3,Pat Three,Payment,50.00",
    ].join("\n");
    const parsed = parseCurveHeroReport("day_sheet", csv);
    // Either every data line is represented (with an error the validator can flag) or the loss is warned about.
    const rowsRepresented = parsed.rows.length === 3;
    const lossWarned = parsed.warnings.some((w) => /row|skipped|unparse|invalid/i.test(w));
    expect({ rows: parsed.rows.length, warnings: parsed.warnings, ok: rowsRepresented || lossWarned }).toMatchObject({
      ok: true,
    });
  });
});
