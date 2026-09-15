import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBankStatementCsv } from "./bank-statement/csv";
import { stageBankRows, summarizeBankRows } from "./bank-statement/validate";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../fixtures/bank-statement/ridgeview-sept.csv"),
  "utf8"
);

describe("bank statement CSV import", () => {
  it("parses signed amount rows", () => {
    const rows = parseBankStatementCsv(fixture);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      postedDate: "2026-09-14",
      description: "DEPOSIT CASH MAIN",
      amountCents: 25000,
    });
    expect(rows[2].amountCents).toBe(-15000);
  });

  it("validates and summarizes staged rows", () => {
    const parsed = parseBankStatementCsv(fixture);
    const staged = stageBankRows(parsed);
    const summary = summarizeBankRows(staged);
    expect(summary.status).toBe("validated");
    expect(summary.rowCount).toBe(3);
    expect(summary.periodStart).toBe("2026-09-14");
    expect(summary.periodEnd).toBe("2026-09-15");
    expect(summary.totals).toEqual({
      creditCents: 35000,
      debitCents: 15000,
      netCents: 20000,
    });
  });

  it("rejects zero-amount rows", () => {
    const staged = stageBankRows([
      {
        postedDate: "2026-09-14",
        description: "EMPTY",
        amountCents: 0,
        reference: null,
        balanceCents: null,
      },
    ]);
    expect(summarizeBankRows(staged).status).toBe("failed");
  });
});
