import { describe, expect, it } from "vitest";
import { parseCsv, parseIsoDate, parseMoneyToCents } from "./csv";
import { parseCurveHeroDaySheet } from "./curve-hero/daySheet";
import { parseBankStatementCsv } from "./bank-statement/csv";
import { parseCurveHeroReport } from "./parse";

/**
 * Swarm 2, lens import-bank-statements: hostile CSV and money/date parsing
 * in the shared parser every Curve Hero report and bank statement goes
 * through. Each test asserts the correct behaviour and fails on the
 * reference commit; the failing assertion is the measured breach.
 */

describe("S2 import-bank-statements: shared CSV / money / date parser", () => {
  // Negative control: "-5.00", "(5.50)" and "5.50" parse correctly on the reference commit.
  it("S2-import-bank-statements-1: a signed negative amount with cents keeps its sign for the whole value", () => {
    expect(parseMoneyToCents("-5.50")).toBe(-550);
    expect(parseMoneyToCents("-0.50")).toBe(-50);
    expect(parseMoneyToCents("-$1,234.56")).toBe(-123456);
    expect(parseMoneyToCents("(-5.00)")).toBe(-500);
  });

  // Negative control: "abc", "5.123" and "1.2.3" are already rejected (null) on the reference commit.
  it("S2-import-bank-statements-2: exponent, hexadecimal and other non-decimal money notations are rejected", () => {
    expect(parseMoneyToCents("1e3")).toBeNull();
    expect(parseMoneyToCents("1e-2")).toBeNull();
    expect(parseMoneyToCents("0x10")).toBeNull();
    expect(parseMoneyToCents("0b11")).toBeNull();
    expect(parseMoneyToCents("Infinity")).toBeNull();
    expect(parseMoneyToCents("(5.00")).toBeNull();
    expect(parseMoneyToCents("1,0,0.00")).toBeNull();
  });

  // Negative control: "2026-09-12", "9/12/2026" parse to 2026-09-12 and "12-09-2026" is rejected on the reference commit.
  it("S2-import-bank-statements-3: impossible calendar dates are rejected instead of passed through", () => {
    expect(parseIsoDate("2026-13-45")).toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("99/99/2026")).toBeNull();
    expect(parseIsoDate("2026-00-10")).toBeNull();
  });

  // Negative control: the same file without the BOM parses to one bank row on the reference commit.
  it("S2-import-bank-statements-4: a UTF-8 BOM (Excel export) does not hide the first header column", () => {
    const csv = "\uFEFFDate,Description,Amount\n2026-09-12,DEPOSIT CASH MAIN,250.00\n";
    expect(parseCsv(csv)[0][0]).toBe("Date");
    expect(parseBankStatementCsv(csv)).toEqual([
      { postedDate: "2026-09-12", description: "DEPOSIT CASH MAIN", amountCents: 25000, reference: null },
    ]);
  });

  // Negative control: the same content with \n or \r\n line endings parses to three rows on the reference commit.
  it("S2-import-bank-statements-5: CR-only line endings (classic Mac / some bank exports) are split into rows", () => {
    const csv = "Date,Description,Amount\r2026-09-12,DEPOSIT CASH MAIN,250.00\r2026-09-13,ACH FEE,-15.00\r";
    const table = parseCsv(csv);
    expect(table).toHaveLength(3);
    expect(table[0]).toEqual(["Date", "Description", "Amount"]);
    expect(parseBankStatementCsv(csv)).toHaveLength(2);
  });

  // Negative control: a day sheet with three well-formed rows parses to three rows and no warnings on the reference commit.
  it("S2-import-bank-statements-6: a day sheet row whose amount or date cannot be parsed is surfaced, not silently dropped", () => {
    const csv = [
      "Date,Location,Patient MRN,Patient Name,Transaction Type,Amount",
      "2026-09-12,Main,MRN-1,Pat One,Charge,150.00",
      "2026-09-12,Main,MRN-2,Pat Two,Charge,N/A",
      "13/45/2026,Main,MRN-3,Pat Three,Payment,50.00",
      "2026-09-12,Main,MRN-4,Pat Four,Charge,1e3",
    ].join("\n");
    const parsed = parseCurveHeroReport("day_sheet", csv);
    // Either every data line is represented (with an error the validator can flag) or the loss is warned about.
    const rowsRepresented = parsed.rows.length === 4;
    const lossWarned = parsed.warnings.some((w) => /row|skipped|unparse|invalid/i.test(w));
    expect({ rows: parsed.rows.length, warnings: parsed.warnings, ok: rowsRepresented || lossWarned }).toMatchObject({
      ok: true,
    });
    expect(parseCurveHeroDaySheet(csv).map((r) => r.amountCents)).not.toContain(100000);
  });
});
