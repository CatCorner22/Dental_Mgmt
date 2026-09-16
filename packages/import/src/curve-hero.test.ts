import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCurveHeroReport } from "./parse";
import { stageParsedRows, summarizeStagedRows } from "./validate";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/curve-hero");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("Curve Hero report parsers", () => {
  it("parses a day sheet and validates totals", () => {
    const parsed = parseCurveHeroReport("day_sheet", fixture("day-sheet.csv"));
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({
      kind: "day_sheet",
      businessDate: "2026-09-14",
      patientMrn: "CH-10042",
      amountCents: 24500,
    });
    const staged = stageParsedRows(parsed.rows);
    const summary = summarizeStagedRows("day_sheet", staged);
    expect(summary.status).toBe("validated");
    expect(summary.totals.amountCents).toBe(33400 - 10000);
  });

  it("parses AR aging and flags bucket mismatches", () => {
    const parsed = parseCurveHeroReport("ar_aging", fixture("ar-aging.csv"));
    expect(parsed.rows).toHaveLength(2);
    const staged = stageParsedRows(parsed.rows);
    expect(staged.every((row) => row.validationErrors.length === 0)).toBe(true);
    expect(summarizeStagedRows("ar_aging", staged).totals.totalArCents).toBe(23400);
  });

  it("parses deposit slips", () => {
    const parsed = parseCurveHeroReport("deposit_slip", fixture("deposit-slip.csv"));
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({ amountCents: 25000, method: "Cash" });
    const summary = summarizeStagedRows("deposit_slip", stageParsedRows(parsed.rows));
    expect(summary.totals.amountCents).toBe(35000);
  });

  it("parses patient and coverage headers", () => {
    const patients = parseCurveHeroReport("patient_header", fixture("patient-header.csv"));
    expect(patients.rows[0]).toMatchObject({
      kind: "patient_header",
      firstName: "Jane",
      dateOfBirth: "1985-03-12",
    });
    const coverage = parseCurveHeroReport("coverage_header", fixture("coverage-header.csv"));
    expect(coverage.rows).toHaveLength(2);
    expect(coverage.rows[1]).toMatchObject({ coverageRank: 2, carrierName: "MetLife Dental" });
  });

  it("refuses unknown columns", () => {
    expect(() => parseCurveHeroReport("day_sheet", "Foo,Bar\n1,2")).toThrow(/missing columns/i);
  });
});
